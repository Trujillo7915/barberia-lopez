/**
 * Caso de Uso: Agendar Cita y Preparar Sincronización
 * Capa 3: Application Services
 */
import { Appointment } from '../../domain/models/Appointment.js';
import { AvailabilityService } from '../../domain/services/AvailabilityService.js';

export class BookAppointmentUseCase {
  constructor({ appointmentRepo, barberRepo, serviceRepo, calendarGateway }) {
    this.appointmentRepo = appointmentRepo;
    this.barberRepo = barberRepo;
    this.serviceRepo = serviceRepo;
    this.calendarGateway = calendarGateway;
  }

  async execute({ clientName, clientPhone, barberId, serviceId, date, startTime, paymentMethod }) {
    const barber = await this.barberRepo.findById(barberId);
    if (!barber) throw new Error("Barbero no encontrado.");

    const service = await this.serviceRepo.findById(serviceId);
    if (!service) throw new Error("Servicio no encontrado.");

    // Calcular hora_fin sumando la duración en minutos
    const [h, m] = startTime.split(':').map(Number);
    const endTotalMinutes = h * 60 + m + service.durationMinutes;
    const endH = String(Math.floor(endTotalMinutes / 60)).padStart(2, '0');
    const endM = String(endTotalMinutes % 60).padStart(2, '0');
    const endTime = `${endH}:${endM}`;

    // Validar disponibilidad
    const existingAppointments = await this.appointmentRepo.findByDate(date);
    const isAvailable = AvailabilityService.isSlotAvailable(existingAppointments, barberId, date, startTime, endTime);

    if (!isAvailable) {
      throw new Error(`El barbero ${barber.name} ya tiene un turno reservado en esa franja horaria.`);
    }

    const appointment = new Appointment({
      clientName,
      clientPhone,
      barberId,
      serviceId,
      date,
      startTime,
      endTime,
      paymentMethod
    });

    const saved = await this.appointmentRepo.save(appointment);

    // Generar enlaces/payloads para el calendario del cliente
    const calendarPayload = this.calendarGateway.generateSyncData({
      appointment: saved,
      barberName: barber.name,
      serviceName: service.name,
      priceCop: service.priceCop
    });

    return {
      appointment: saved,
      barber,
      service,
      calendarPayload
    };
  }
}
