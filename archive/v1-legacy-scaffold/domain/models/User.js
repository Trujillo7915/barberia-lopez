/**
 * Modelo de Usuario — Capa 1: Domain Model
 */
export class User {
  constructor({ id, username, passwordHash, role, barberId = null, active = true, createdAt = new Date() }) {
    if (!username || !role) {
      throw new Error("El usuario requiere username y rol.");
    }
    this.id = id || crypto.randomUUID();
    this.username = username.toLowerCase().trim();
    this.passwordHash = passwordHash;
    this.role = role;
    this.barberId = barberId;
    this.active = active;
    this.createdAt = createdAt;
  }

  isAdmin() {
    return this.role === 'ADMIN';
  }

  isMaster() {
    return this.role === 'JEFE';
  }

  isPractitioner() {
    return this.role === 'PRACTICANTE';
  }
}
