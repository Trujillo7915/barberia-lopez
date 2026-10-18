/**
 * Servicio de Dominio: Verificación de Disponibilidad y Solapamiento
 * Capa 2: Domain Services
 */
export class AvailabilityService {
  /**
   * Verifica si una nueva cita se solapa con citas existentes del mismo barbero.
   */
  static isSlotAvailable(existingAppointments, barberId, date, newStart, newEnd) {
    const active = existingAppointments.filter(
      (a) => a.barberId === barberId && a.date === date && a.status !== 'CANCELADA'
    );

    const toMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const newStartMin = toMinutes(newStart);
    const newEndMin = toMinutes(newEnd);

    for (const appt of active) {
      const existingStartMin = toMinutes(appt.startTime);
      const existingEndMin = toMinutes(appt.endTime);

      // Solapamiento si los rangos se cruzan
      if (Math.max(newStartMin, existingStartMin) < Math.min(newEndMin, existingEndMin)) {
        return false;
      }
    }

    return true;
  }
}
