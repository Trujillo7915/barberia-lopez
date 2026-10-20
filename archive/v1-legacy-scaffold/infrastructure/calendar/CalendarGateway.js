/**
 * Gateway Unificado de Calendarios
 * Capa 4: Infrastructure Calendar
 */
import { IcsCalendarAdapter } from './IcsCalendarAdapter.js';
import { GoogleCalendarAdapter } from './GoogleCalendarAdapter.js';

export class CalendarGateway {
  generateSyncData({ appointment, barberName, serviceName, priceCop }) {
    const icsString = IcsCalendarAdapter.generateIcsString({
      appointment,
      barberName,
      serviceName,
      priceCop
    });

    const googleUrl = GoogleCalendarAdapter.generateUrl({
      appointment,
      barberName,
      serviceName,
      priceCop
    });

    return {
      icsString,
      googleUrl,
      downloadIcs: () => IcsCalendarAdapter.downloadIcsFile(icsString, `Cita_${barberName.replace(/\s+/g, '_')}.ics`)
    };
  }
}
