/**
 * Servicio de Dominio: Cálculo y Arqueo de Caja
 * Capa 2: Domain Services
 */
export class CashCalculatorService {
  /**
   * Consolida el total recaudado para una fecha, discriminado por barbero.
   */
  static calculateDailyCash(historyList, dateStr) {
    const dayRecords = historyList.filter((r) => r.date === dateStr);

    let totalConsolidated = 0;
    const byBarber = {};

    for (const record of dayRecords) {
      totalConsolidated += record.priceCop;
      if (!byBarber[record.barberId]) {
        byBarber[record.barberId] = {
          count: 0,
          total: 0
        };
      }
      byBarber[record.barberId].count += 1;
      byBarber[record.barberId].total += record.priceCop;
    }

    return {
      date: dateStr,
      totalCount: dayRecords.length,
      totalConsolidatedCop: totalConsolidated,
      breakdownByBarber: byBarber
    };
  }
}
