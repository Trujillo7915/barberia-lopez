/**
 * Caso de Uso: Finalizar Corte y Registrar en Historial
 * Capa 3: Application Services
 */
import { CutHistory } from '../../domain/models/CutHistory.js';
import { AppointmentStatus } from '../../domain/types/Enums.js';

export class CompleteCutUseCase {
  constructor({ appointmentRepo, serviceRepo, historyRepo }) {
    this.appointmentRepo = appointmentRepo;
    this.serviceRepo = serviceRepo;
    this.historyRepo = historyRepo;
  }

  async execute({ appointmentId, user }) {
    const appointment = await this.appointmentRepo.findById(appointmentId);
    if (!appointment) throw new Error("Cita no encontrada.");

    // Validar que el practicante solo pueda completar sus propias citas
    if (user.role === 'PRACTICANTE' && user.barberId !== appointment.barberId) {
      throw new Error("No tienes autorización para modificar citas de otra estación.");
    }

    const service = await this.serviceRepo.findById(appointment.serviceId);
    const priceCop = service ? service.priceCop : 0;

    appointment.status = AppointmentStatus.COMPLETADA;
    await this.appointmentRepo.update(appointment);

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const cutRecord = new CutHistory({
      appointmentId: appointment.id,
      barberId: appointment.barberId,
      clientName: appointment.clientName,
      date: appointment.date,
      time: currentTime,
      priceCop: priceCop
    });

    const savedHistory = await this.historyRepo.save(cutRecord);

    return {
      appointment,
      cutRecord: savedHistory
    };
  }
}
