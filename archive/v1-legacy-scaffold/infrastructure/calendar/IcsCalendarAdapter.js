/**
 * Adaptador RFC 5545 iCalendar (.ics)
 * Capa 4: Infrastructure Calendar
 */
export class IcsCalendarAdapter {
  /**
   * Genera la cadena de texto con formato iCalendar estándar.
   */
  static generateIcsString({ appointment, barberName, serviceName, priceCop }) {
    // Formatear fechas YYYYMMDDTHHMMSS
    const cleanDate = appointment.date.replace(/-/g, '');
    const cleanStart = appointment.startTime.replace(/:/g, '') + '00';
    const cleanEnd = appointment.endTime.replace(/:/g, '') + '00';

    const dtStart = `${cleanDate}T${cleanStart}`;
    const dtEnd = `${cleanDate}T${cleanEnd}`;

    const description = `Servicio: ${serviceName}\\nBarbero: ${barberName}\\nValor: $${priceCop.toLocaleString('es-CO')} COP\\nUbicación: Barbería Lopez, Neiva, Huila`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Barberia Lopez//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${appointment.calendarEventUid || appointment.id + '@barberialopez.co'}`,
      `SUMMARY:Cita Barbería Lopez - ${serviceName}`,
      `DESCRIPTION:${description}`,
      'LOCATION:Barbería Lopez, Neiva, Huila',
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT60M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Recordatorio de Cita en Barbería Lopez (en 1 hora)',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  /**
   * Dispara la descarga del archivo .ics en el navegador del dispositivo
   */
  static downloadIcsFile(icsContent, filename = 'cita_barberia_lopez.ics') {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
