export const TURKISH_HOLIDAYS_2026 = [
    '2026-01-01', // Yılbaşı
    '2026-03-19', // Ramazan Bayramı Arifesi (Yarım)
    '2026-03-20', '2026-03-21', '2026-03-22', // Ramazan Bayramı
    '2026-04-23', // Ulusal Egemenlik
    '2026-05-01', // Emek ve Dayanışma
    '2026-05-19', // Gençlik ve Spor
    '2026-05-26', // Kurban Bayramı Arifesi (Yarım)
    '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', // Kurban Bayramı
    '2026-07-15', // Demokrasi ve Milli Birlik
    '2026-08-30', // Zafer Bayramı
    '2026-10-28', // Cumhuriyet Bayramı Arifesi (Yarım)
    '2026-10-29'  // Cumhuriyet Bayramı
];

export const HALF_DAY_HOLIDAYS_2026 = ['2026-03-19', '2026-05-26', '2026-10-28'];

export const isPublicHoliday = (date: string) => TURKISH_HOLIDAYS_2026.includes(date);
export const isSunday = (date: string) => new Date(date).getDay() === 0;

export const calculateOvertimeHours = (date: string, start: string, end: string, isOffDay: boolean) => {
    if (!start || !end) return 0;
    
    const isHoliday = isPublicHoliday(date) || isSunday(date) || isOffDay;
    const isHalfDay = HALF_DAY_HOLIDAYS_2026.includes(date);
    
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    
    let startMinutes = h1 * 60 + m1;
    let endMinutes = h2 * 60 + m2;
    if (endMinutes < startMinutes) endMinutes += 1440; 

    const totalMinutes = endMinutes - startMinutes;

    // Tam tatil günü: Her dakika mesaidir
    if (isHoliday && !isHalfDay) {
        return totalMinutes / 60;
    }

    // Normal gün veya Yarım gün tatil: Normal çalışma aralığı dışı mesaidir
    const normalStart = 8 * 60; // 08:00
    const normalEnd = isHalfDay ? (13 * 60) : (18 * 60); // 13:00 veya 18:00

    const intersectionStart = Math.max(startMinutes, normalStart);
    const intersectionEnd = Math.min(endMinutes, normalEnd);

    let normalMinutes = 0;
    if (intersectionEnd > intersectionStart) {
        normalMinutes = intersectionEnd - intersectionStart;
    }

    const overtimeMinutes = Math.max(0, totalMinutes - normalMinutes);
    return overtimeMinutes / 60;
};
