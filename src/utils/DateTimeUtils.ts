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

export const isDatcaPersonnel = (name: string): boolean => {
    if (!name) return false;
    const clean = name.toLocaleLowerCase('tr-TR').trim();
    return clean.includes('süleyman aşkın') || 
           clean.includes('adem araslı') || 
           clean.includes('adem arasli') || 
           clean.includes('mehmet günay') || 
           clean.includes('zafer durmaz');
};

export const isWeekend = (date: string): boolean => {
    if (!date) return false;
    // getDay() returns 0 for Sunday, 6 for Saturday
    const day = new Date(date).getDay();
    return day === 0 || day === 6;
};

export const calculateOvertimeHours = (
    date: string, 
    start: string, 
    end: string, 
    isOffDay: boolean,
    personnelName?: string
) => {
    if (!start || !end) return 0;
    
    let finalOffDay = isOffDay;
    if (personnelName && isDatcaPersonnel(personnelName) && isWeekend(date)) {
        finalOffDay = true;
    }
    
    const isHoliday = isPublicHoliday(date) || finalOffDay;
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

    // Normal gün veya Yarım gün tatil: 
    // 08:00 öncesi sabah başlama saatleri mesai sayılmaz.
    // Mesai sadece 18:00 (yarım günde 13:00) sonrası kalan saatler ve gece vardiyaları için hesaplanır.
    const normalEnd = isHalfDay ? (13 * 60) : (18 * 60); // 13:00 veya 18:00

    let overtimeMinutes = 0;
    
    // 18:00 (veya 13:00) sonrası akşam/gece çalışması
    if (endMinutes > normalEnd) {
        overtimeMinutes += (endMinutes - Math.max(startMinutes, normalEnd));
    }

    // Gece vardiyası (06:00 öncesinde başlayan ve 08:00 öncesinde biten gece çalışmaları)
    if (startMinutes < (6 * 60) && endMinutes <= (8 * 60)) {
        overtimeMinutes += (endMinutes - startMinutes);
    }

    return overtimeMinutes / 60;
};
