/**
 * Modelo de Servicio / Combo — Capa 1: Domain Model
 */
export class Service {
  constructor({ id, name, category, durationMinutes, priceCop, description = '', active = true }) {
    if (!name || priceCop == null) throw new Error("Servicio requiere nombre y precio.");
    this.id = id || crypto.randomUUID();
    this.name = name.trim();
    this.category = category;
    this.durationMinutes = Number(durationMinutes) || 30;
    this.priceCop = Number(priceCop);
    this.description = description;
    this.active = active;
  }
}
