import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, AlertCircle, Scale, RefreshCcw } from 'lucide-react';

interface Deadline {
    id: string;
    date: string;
    gracePeriodEnd: string;
    gracePeriodFormatted: string;
    description: string;
    isFatal: boolean;
    isUrgent: boolean;
    businessDaysRemaining: number;
    notificationId: number;
    court: string;
    procedureNumber: string;
}

const CalendarView: React.FC = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [allDeadlines, setAllDeadlines] = useState<Deadline[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDeadlines();
    }, []);

    const fetchDeadlines = async () => {
        try {
            const response = await fetch('/api/deadlines', { credentials: 'include' });
            if (response.ok) {
                const deadlines: Deadline[] = await response.json();
                setAllDeadlines(deadlines);
            }
        } catch (error) {
            console.error('Error fetching deadlines:', error);
        } finally {
            setLoading(false);
        }
    };

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 is Sunday
    // Adjust for Monday start (Spain)
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startOffset }, (_, i) => i);

    const getDeadlinesForDay = (day: number) => {
        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return allDeadlines.filter(d => d.date === dateStr);
    };

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const monthName = currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCcw className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-4">
             <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Agenda Procesal</h2>
                    <p className="text-gray-500">Vista de señalamientos y plazos fatales. {allDeadlines.length > 0 ? `${allDeadlines.length} plazos encontrados.` : 'No hay plazos registrados.'}</p>
                </div>
                <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600"><ChevronLeft size={20} /></button>
                    <span className="font-bold text-gray-800 w-40 text-center capitalize">{monthName}</span>
                    <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md text-gray-600"><ChevronRight size={20} /></button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                {/* Header Days */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => (
                        <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-gray-200 gap-px">
                    {emptyDays.map(d => <div key={`empty-${d}`} className="bg-white min-h-[100px]"></div>)}
                    
                    {days.map(day => {
                        const deadlines = getDeadlinesForDay(day);
                        return (
                            <div key={day} className="bg-white p-2 min-h-[120px] hover:bg-gray-50 transition-colors flex flex-col gap-1 group relative">
                                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${deadlines.length > 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}`}>
                                    {day}
                                </span>
                                
                                <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                                    {deadlines.map(d => (
                                        <div key={d.id} 
                                            className={`text-[10px] p-1.5 rounded border mb-0.5 cursor-pointer hover:opacity-80 shadow-sm ${
                                            d.isUrgent 
                                            ? 'bg-orange-50 border-orange-300 text-orange-900 ring-2 ring-orange-400' 
                                            : d.isFatal 
                                            ? 'bg-red-50 border-red-200 text-red-800' 
                                            : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                        }`}
                                            title={`Gracia: ${d.gracePeriodFormatted || 'N/A'}\nDías hábiles restantes: ${d.businessDaysRemaining}`}
                                        >
                                            <div className="flex items-center gap-1 font-bold mb-0.5">
                                                {d.isUrgent && <span className="text-orange-600">!</span>}
                                                {d.isFatal ? <AlertCircle size={10} /> : <Scale size={10} />}
                                                <span>{d.date.split('-')[2]}/{d.date.split('-')[1]}</span>
                                                {d.businessDaysRemaining <= 3 && d.businessDaysRemaining > 0 && (
                                                    <span className="ml-auto text-[8px] bg-orange-200 text-orange-800 px-1 rounded">
                                                        {d.businessDaysRemaining}d
                                                    </span>
                                                )}
                                            </div>
                                            <div className="truncate font-medium">{d.description}</div>
                                            <div className="opacity-75 truncate">{d.procedureNumber}</div>
                                            {d.gracePeriodFormatted && (
                                                <div className="text-[8px] opacity-60 mt-0.5 truncate">
                                                    Gracia: {d.gracePeriodFormatted.split(' ').slice(0, 3).join(' ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {deadlines.length === 0 && (
                                    <button className="opacity-0 group-hover:opacity-100 absolute bottom-2 right-2 text-gray-400 hover:text-blue-500 transition-opacity">
                                        +
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default CalendarView;