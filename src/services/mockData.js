export const MOCK_DATA = {
    stats: {
        salesToday: 184300,
        growth: 12.4,
        activeOrders: 23,
        lowStockCount: 7,
        totalProducts: 248,
        monthlyRevenue: 4820000,
        netProfit: 1240000,
        grossMargin: 25.7,
    },
    salesWeek: [
        { day: 'Lun', total: 185000 },
        { day: 'Mar', total: 245000 },
        { day: 'Mer', total: 156000 },
        { day: 'Jeu', total: 298000 },
        { day: 'Ven', total: 226000 },
        { day: 'Sam', total: 120000 },
        { day: 'Dim', total: 82000 },
    ],
    recentSales: [
        { id: 1, invoice: 'FAC-1052', client: 'Ahmed H.', initials: 'AH', items: 3, date: '07/04/2026', total: 95400, status: 'paid' },
        { id: 2, invoice: 'FAC-1051', client: 'Sara R.', initials: 'SR', items: 1, date: '06/04/2026', total: 32000, status: 'pending' },
        { id: 3, invoice: 'FAC-1050', client: 'M. Benali', initials: 'MB', items: 5, date: '05/04/2026', total: 187500, status: 'paid' },
    ],
    lowStock: [
        { id: 1, name: 'Ordinateur HP ProBook', current: 2, min: 2, category: 'Informatique' },
        { id: 2, name: 'Souris Logitech MX', current: 8, min: 10, category: 'Accessoires' },
        { id: 3, name: 'Écran Samsung 24"', current: 3, min: 3, category: 'Informatique' },
    ],
    employees: [
        { id: 1, name: 'Ali Mansouri', role: 'Responsable ventes', initials: 'AM', status: 'present', color: '#E3F2FD', textColor: '#0D47A1' },
        { id: 2, name: 'Fatima Bouzid', role: 'Comptable', initials: 'FB', status: 'present', color: '#F3E5F5', textColor: '#4A148C' },
        { id: 3, name: 'Yacine Djamel', role: 'Magasinier', initials: 'YD', status: 'leave', color: '#FFF3E0', textColor: '#E65100' },
        { id: 4, name: 'Samira Rais', role: 'Administratrice', initials: 'SR', status: 'absent', color: '#E8F5E9', textColor: '#1B5E20' },
        { id: 5, name: 'Kamel Mehdi', role: 'Commercial', initials: 'KM', status: 'present', color: '#FCE4EC', textColor: '#880E4F' },
    ],
    salesStats: {
        total: 1245000,
        count: 45,
        average: 27666,
    },
    alerts: [],
};