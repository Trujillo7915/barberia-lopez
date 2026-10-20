/**
 * Caso de Uso: Consulta de Historial (con Aislamiento de Practicante)
 * Capa 3: Application Services
 */
export class GetBarberHistoryUseCase {
  constructor({ historyRepo, barberRepo }) {
    this.historyRepo = historyRepo;
    this.barberRepo = barberRepo;
  }

  async execute({ user }) {
    if (!user) throw new Error("Usuario no autenticado.");

    const allHistory = await this.historyRepo.findAll();
    const barbers = await this.barberRepo.findAll();
    const barberMap = new Map(barbers.map((b) => [b.id, b.name]));

    // Si es Practicante: Filtrar ESTRICTAMENTE por su barberId
    if (user.role === 'PRACTICANTE') {
      const personalRecords = allHistory
        .filter((r) => r.barberId === user.barberId)
        .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`));

      return personalRecords.map((r) => ({
        ...r,
        barberName: barberMap.get(r.barberId) || 'Mi Estación'
      }));
    }

    // Si es Jefe o Admin: Retornar consolidado ordenado cronológicamente
    return allHistory
      .sort((a, b) => new Date(`${b.date}T${b.time}`) - new Date(`${a.date}T${a.time}`))
      .map((r) => ({
        ...r,
        barberName: barberMap.get(r.barberId) || 'Barbero'
      }));
  }
}
