import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, offices, userInvitations, insertUserSchema, type User } from "../shared/schema";
import { db, pool } from "./db";
import { eq, and, gt } from "drizzle-orm";
import { fromZodError } from "zod-validation-error";

declare global {
  namespace Express {
    interface User extends Omit<import("../shared/schema").User, "password"> {}
  }
}

const scryptAsync = promisify(scrypt);
const PostgresSessionStore = connectPg(session);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

async function getUserByUsername(username: string) {
  return db.select().from(users).where(eq(users.username, username)).limit(1);
}

async function getUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).limit(1);
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "No autorizado para esta acción" });
    }
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "No autenticado" });
  }
  next();
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
  
  const store = new PostgresSessionStore({ 
    pool, 
    createTableIfMissing: true,
    tableName: "session"
  });
  
  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Usuario no encontrado" });
        }
        if (!user.isActive) {
          return done(null, false, { message: "Usuario desactivado" });
        }
        if (user.isPendingApproval) {
          return done(null, false, { message: "Tu cuenta está pendiente de aprobación por un administrador" });
        }
        const isValid = await comparePasswords(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Contraseña incorrecta" });
        }
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await getUserById(id);
      if (!user) {
        return done(null, false);
      }
      const { password: _, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const { inviteCode, joinCode, ...userData } = req.body;
      
      const result = insertUserSchema.safeParse(userData);
      if (!result.success) {
        const error = fromZodError(result.error);
        return res.status(400).json({ error: error.toString() });
      }

      const [existingUser] = await getUserByUsername(result.data.username);
      if (existingUser) {
        return res.status(400).json({ error: "El usuario ya existe" });
      }

      const existingEmail = await db.select().from(users).where(eq(users.email, result.data.email)).limit(1);
      if (existingEmail.length > 0) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }

      let officeId: number | undefined;
      let teamId: number | undefined;
      let role: 'ADMIN' | 'LAWYER' | 'ASSISTANT' = 'ASSISTANT';
      let isPendingApproval = true;
      let invitationId: number | undefined;

      if (inviteCode) {
        const invitations = await db.select()
          .from(userInvitations)
          .where(and(
            eq(userInvitations.inviteCode, inviteCode),
            eq(userInvitations.status, 'PENDING'),
            gt(userInvitations.expiresAt, new Date())
          ))
          .limit(1);
        
        if (invitations.length === 0) {
          return res.status(400).json({ error: "Código de invitación inválido o expirado" });
        }
        
        const invitation = invitations[0] as { id: number; email: string; officeId: number; teamId: number | null; role: 'ADMIN' | 'LAWYER' | 'ASSISTANT' };
        
        if (invitation.email.toLowerCase() !== result.data.email.toLowerCase()) {
          return res.status(400).json({ error: "El email no coincide con la invitación" });
        }
        
        officeId = invitation.officeId;
        teamId = invitation.teamId || undefined;
        role = invitation.role;
        isPendingApproval = false;
        invitationId = invitation.id;
      } else if (joinCode) {
        const [office] = await db.select()
          .from(offices)
          .where(and(
            eq(offices.joinCode, joinCode),
            eq(offices.isActive, true)
          ))
          .limit(1);
        
        if (!office) {
          return res.status(400).json({ error: "Código de oficina inválido" });
        }
        
        officeId = office.id;
        isPendingApproval = true;
      } else {
        return res.status(400).json({ 
          error: "Se requiere un código de invitación o código de oficina para registrarse" 
        });
      }

      const hashedPassword = await hashPassword(result.data.password);
      const [user] = await db
        .insert(users)
        .values({
          username: result.data.username,
          email: result.data.email,
          password: hashedPassword,
          fullName: result.data.fullName,
          role,
          officeId,
          teamId,
          isPendingApproval,
        })
        .returning();

      if (invitationId) {
        await db.update(userInvitations)
          .set({ 
            status: 'ACCEPTED', 
            acceptedBy: user.id,
            acceptedAt: new Date()
          })
          .where(eq(userInvitations.id, invitationId));
      }

      const { password: _, ...userWithoutPassword } = user;

      if (isPendingApproval) {
        return res.status(201).json({ 
          ...userWithoutPassword,
          message: "Registro completado. Un administrador debe aprobar tu cuenta antes de poder acceder." 
        });
      }

      req.login(userWithoutPassword as Express.User, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string }) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: info?.message || "Credenciales inválidas" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "No autenticado" });
    }
    res.json(req.user);
  });

  app.post("/api/invitations", requireRole('ADMIN'), async (req, res, next) => {
    try {
      const { email, officeId, teamId, role, expiresInDays = 7 } = req.body;
      
      if (!email || !officeId) {
        return res.status(400).json({ error: "Email y oficina son requeridos" });
      }

      const inviteCode = randomBytes(16).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const [invitation] = await db.insert(userInvitations)
        .values({
          email,
          officeId,
          teamId,
          role: role || 'ASSISTANT',
          inviteCode,
          invitedBy: req.user!.id,
          expiresAt,
        })
        .returning();

      res.status(201).json(invitation);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/invitations", requireRole('ADMIN'), async (req, res, next) => {
    try {
      const invitations = await db.select().from(userInvitations).orderBy(userInvitations.createdAt);
      res.json(invitations);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/invitations/:id", requireRole('ADMIN'), async (req, res, next) => {
    try {
      await db.update(userInvitations)
        .set({ status: 'REVOKED' })
        .where(eq(userInvitations.id, parseInt(req.params.id)));
      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users/pending", requireRole('ADMIN'), async (req, res, next) => {
    try {
      const pendingUsers = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        officeId: users.officeId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.isPendingApproval, true));
      res.json(pendingUsers);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/users/:id/approve", requireRole('ADMIN'), async (req, res, next) => {
    try {
      const { role, teamId } = req.body;
      const userId = parseInt(req.params.id);
      
      const [updatedUser] = await db.update(users)
        .set({ 
          isPendingApproval: false,
          approvedBy: req.user!.id,
          approvedAt: new Date(),
          role: role || undefined,
          teamId: teamId || undefined,
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/users/:id/reject", requireRole('ADMIN'), async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      
      await db.update(users)
        .set({ isActive: false })
        .where(eq(users.id, userId));

      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });
}
