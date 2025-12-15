import { Router } from 'express';
import { db } from './db';
import { 
  offices, 
  teams, 
  categories, 
  users,
  holidays,
  deadlineRules,
  emailTemplates,
  eventTemplates
} from '../shared/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const router = Router();

router.get('/offices', async (req, res) => {
  try {
    const allOffices = await db.select().from(offices).orderBy(offices.name);
    res.json(allOffices);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching offices' });
  }
});

router.post('/offices', async (req, res) => {
  try {
    const { name, code, timezone, commonCalendarId, teamsChannelId, genericEmail } = req.body;
    const [newOffice] = await db.insert(offices).values({
      name,
      code,
      timezone: timezone || 'Europe/Madrid',
      commonCalendarId,
      teamsChannelId,
      genericEmail
    }).returning();
    res.json(newOffice);
  } catch (error) {
    res.status(500).json({ error: 'Error creating office' });
  }
});

router.put('/offices/:id', async (req, res) => {
  try {
    const { name, code, timezone, commonCalendarId, teamsChannelId, genericEmail, isActive } = req.body;
    const [updated] = await db
      .update(offices)
      .set({
        name,
        code,
        timezone,
        commonCalendarId,
        teamsChannelId,
        genericEmail,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(offices.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating office' });
  }
});

router.get('/teams', async (req, res) => {
  try {
    const allTeams = await db.select().from(teams).orderBy(teams.name);
    res.json(allTeams);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching teams' });
  }
});

router.post('/teams', async (req, res) => {
  try {
    const { name, code, officeId, description } = req.body;
    const [newTeam] = await db.insert(teams).values({
      name,
      code,
      officeId,
      description
    }).returning();
    res.json(newTeam);
  } catch (error) {
    res.status(500).json({ error: 'Error creating team' });
  }
});

router.put('/teams/:id', async (req, res) => {
  try {
    const { name, code, officeId, description, isActive } = req.body;
    const [updated] = await db
      .update(teams)
      .set({
        name,
        code,
        officeId,
        description,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(teams.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating team' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const allCategories = await db.select().from(categories).orderBy(categories.name);
    res.json(allCategories);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, code, outlookCategoryName, outlookColor, emailHighlightColor } = req.body;
    const [newCategory] = await db.insert(categories).values({
      name,
      code,
      outlookCategoryName,
      outlookColor,
      emailHighlightColor
    }).returning();
    res.json(newCategory);
  } catch (error) {
    res.status(500).json({ error: 'Error creating category' });
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const { name, code, outlookCategoryName, outlookColor, emailHighlightColor, isActive } = req.body;
    const [updated] = await db
      .update(categories)
      .set({
        name,
        code,
        outlookCategoryName,
        outlookColor,
        emailHighlightColor,
        isActive
      })
      .where(eq(categories.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating category' });
  }
});

router.get('/holidays', async (req, res) => {
  try {
    const { officeId, year } = req.query;
    let query = db.select().from(holidays);
    
    if (officeId) {
      query = query.where(eq(holidays.officeId, parseInt(officeId as string))) as any;
    }
    
    const allHolidays = await query.orderBy(holidays.date);
    res.json(allHolidays);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching holidays' });
  }
});

router.post('/holidays', async (req, res) => {
  try {
    const { officeId, date, name, isNational, region } = req.body;
    const [newHoliday] = await db.insert(holidays).values({
      officeId,
      date,
      name,
      isNational,
      region
    }).returning();
    res.json(newHoliday);
  } catch (error) {
    res.status(500).json({ error: 'Error creating holiday' });
  }
});

router.delete('/holidays/:id', async (req, res) => {
  try {
    await db.delete(holidays).where(eq(holidays.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting holiday' });
  }
});

router.get('/deadline-rules', async (req, res) => {
  try {
    const rules = await db.select().from(deadlineRules).orderBy(deadlineRules.procedureType);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching deadline rules' });
  }
});

router.post('/deadline-rules', async (req, res) => {
  try {
    const { procedureType, actType, deadlineDays, isBusinessDays, augustExempt, description, derivedEvents } = req.body;
    const [newRule] = await db.insert(deadlineRules).values({
      procedureType,
      actType,
      deadlineDays,
      isBusinessDays,
      augustExempt,
      description,
      derivedEvents
    }).returning();
    res.json(newRule);
  } catch (error) {
    res.status(500).json({ error: 'Error creating deadline rule' });
  }
});

router.put('/deadline-rules/:id', async (req, res) => {
  try {
    const { procedureType, actType, deadlineDays, isBusinessDays, augustExempt, description, derivedEvents, isActive } = req.body;
    const [updated] = await db
      .update(deadlineRules)
      .set({
        procedureType,
        actType,
        deadlineDays,
        isBusinessDays,
        augustExempt,
        description,
        derivedEvents,
        isActive
      })
      .where(eq(deadlineRules.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating deadline rule' });
  }
});

router.get('/email-templates', async (req, res) => {
  try {
    const templates = await db.select().from(emailTemplates).orderBy(emailTemplates.name);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching email templates' });
  }
});

router.post('/email-templates', async (req, res) => {
  try {
    const { code, name, purpose, subjectTemplate, bodyTemplate, isHtml, variables } = req.body;
    const [newTemplate] = await db.insert(emailTemplates).values({
      code,
      name,
      purpose,
      subjectTemplate,
      bodyTemplate,
      isHtml,
      variables
    }).returning();
    res.json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: 'Error creating email template' });
  }
});

router.put('/email-templates/:id', async (req, res) => {
  try {
    const { code, name, purpose, subjectTemplate, bodyTemplate, isHtml, variables, isActive } = req.body;
    const [updated] = await db
      .update(emailTemplates)
      .set({
        code,
        name,
        purpose,
        subjectTemplate,
        bodyTemplate,
        isHtml,
        variables,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(emailTemplates.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating email template' });
  }
});

router.get('/event-templates', async (req, res) => {
  try {
    const templates = await db.select().from(eventTemplates).orderBy(eventTemplates.name);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching event templates' });
  }
});

router.post('/event-templates', async (req, res) => {
  try {
    const { code, name, eventType, titleTemplate, isAllDay, durationMinutes, reminderMinutes, variables } = req.body;
    const [newTemplate] = await db.insert(eventTemplates).values({
      code,
      name,
      eventType,
      titleTemplate,
      isAllDay,
      durationMinutes,
      reminderMinutes,
      variables
    }).returning();
    res.json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: 'Error creating event template' });
  }
});

router.put('/event-templates/:id', async (req, res) => {
  try {
    const { code, name, eventType, titleTemplate, isAllDay, durationMinutes, reminderMinutes, variables, isActive } = req.body;
    const [updated] = await db
      .update(eventTemplates)
      .set({
        code,
        name,
        eventType,
        titleTemplate,
        isAllDay,
        durationMinutes,
        reminderMinutes,
        variables,
        isActive
      })
      .where(eq(eventTemplates.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating event template' });
  }
});

router.get('/people', async (req, res) => {
  try {
    const people = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        officeId: users.officeId,
        teamId: users.teamId,
        categoryId: users.categoryId,
        teamsUserId: users.teamsUserId,
        isActive: users.isActive
      })
      .from(users)
      .orderBy(users.fullName);
    res.json(people);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching people' });
  }
});

router.put('/people/:id', async (req, res) => {
  try {
    const { officeId, teamId, categoryId, teamsUserId, tutorUserId, role, isActive } = req.body;
    const [updated] = await db
      .update(users)
      .set({
        officeId,
        teamId,
        categoryId,
        teamsUserId,
        tutorUserId,
        role,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(users.id, parseInt(req.params.id)))
      .returning();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error updating person' });
  }
});

export default router;
