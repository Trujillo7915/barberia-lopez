/**
 * Adaptador de Enlaces para Google Calendar
 * Capa 4: Infrastructure Calendar
 */
export class GoogleCalendarAdapter {
  /**
   * Genera la URL universal para abrir directamente en la app/web de Google Calendar.
   */
  static generateUrl({ appointment, barberName, serviceName, priceCop }) {
    const cleanDate = appointment.date.replace(/-/g, '');
    const cleanStart = appointment.startTime.replace(/:/g, '') + '00';
    const cleanEnd = appointment.endTime.replace(/:/g, '') + '00';

    const dates = `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`;
    const text = encodeURIComponent(`Cita Barbería Lopez - ${serviceName}`);
    const details = encodeURIComponent(
      `Cita agendada con ${barberName}.\nServicio: ${serviceName}\nValor: $${priceCop.toLocaleString('es-CO')} COP\nMétodo de pago: ${appointment.paymentMethod}\nLínea oficial: +57 321 989 7910`
    );
    const location = encodeURIComponent('Barbería Lopez, Neiva, Huila');

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
  }
}
