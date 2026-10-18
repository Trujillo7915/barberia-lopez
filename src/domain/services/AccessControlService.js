/**
 * Servicio de Dominio: Control de Acceso y Aislamiento de Roles (RBAC)
 * Capa 2: Domain Services
 */
import { Roles } from '../types/Enums.js';

export class AccessControlService {
  /**
   * Determina si el usuario tiene permiso para visualizar la caja financiera general.
   */
  static canViewCashRegister(user) {
    if (!user) return false;
    return user.role === Roles.JEFE || user.role === Roles.ADMIN;
  }

  /**
   * Determina si el usuario puede ver la agenda de otro barbero.
   */
  static canViewOtherBarberAgenda(user) {
    if (!user) return false;
    return user.role === Roles.JEFE || user.role === Roles.ADMIN;
  }

  /**
   * Determina si el usuario puede administrar barberos y cambiar contraseñas.
   */
  static canManageCredentials(user) {
    if (!user) return false;
    return user.role === Roles.ADMIN;
  }

  /**
   * Filtra la lista pública de barberos ocultando al administrador (Principio de Admin Incógnito).
   */
  static filterPublicBarbers(barbersList, usersList) {
    const adminUserIds = new Set(
      usersList.filter((u) => u.role === Roles.ADMIN).map((u) => u.id)
    );
    return barbersList.filter((b) => b.active && !adminUserIds.has(b.userId));
  }
}
