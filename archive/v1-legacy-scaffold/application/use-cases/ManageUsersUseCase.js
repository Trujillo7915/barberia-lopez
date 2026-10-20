/**
 * Caso de Uso: Gestión de Barberos y Credenciales (Exclusivo Administrador)
 * Capa 3: Application Services
 */
import { User } from '../../domain/models/User.js';
import { Barber } from '../../domain/models/Barber.js';
import { AccessControlService } from '../../domain/services/AccessControlService.js';

export class ManageUsersUseCase {
  constructor({ userRepo, barberRepo }) {
    this.userRepo = userRepo;
    this.barberRepo = barberRepo;
  }

  async createBarber({ adminUser, name, specialty, phone, username, password, role }) {
    if (!AccessControlService.canManageCredentials(adminUser)) {
      throw new Error("Acceso denegado: solo el Administrador puede crear barberos.");
    }

    const existingUser = await this.userRepo.findByUsername(username);
    if (existingUser) {
      throw new Error(`El nombre de usuario '${username}' ya se encuentra en uso.`);
    }

    const barber = new Barber({
      name,
      specialty: specialty || 'Barbero Profesional',
      phone
    });
    const savedBarber = await this.barberRepo.save(barber);

    const user = new User({
      username,
      passwordHash: password, // Repositorio aplica el cifrado o hash seguro
      role,
      barberId: savedBarber.id
    });
    const savedUser = await this.userRepo.save(user);

    savedBarber.userId = savedUser.id;
    await this.barberRepo.update(savedBarber);

    return { user: savedUser, barber: savedBarber };
  }

  async changePassword({ adminUser, userId, newPassword }) {
    if (!AccessControlService.canManageCredentials(adminUser)) {
      throw new Error("Acceso denegado: solo el Administrador puede cambiar contraseñas.");
    }
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error("La nueva contraseña debe tener al menos 4 caracteres.");
    }

    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error("Usuario no encontrado.");

    await this.userRepo.updatePassword(user.id, newPassword);
    return { success: true, message: `Contraseña de @${user.username} actualizada correctamente.` };
  }

  async toggleUserStatus({ adminUser, userId }) {
    if (!AccessControlService.canManageCredentials(adminUser)) {
      throw new Error("Acceso denegado: solo el Administrador puede modificar estados.");
    }
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error("Usuario no encontrado.");
    if (user.role === 'ADMIN') throw new Error("No se puede desactivar la cuenta de Administrador.");

    user.active = !user.active;
    await this.userRepo.update(user);

    if (user.barberId) {
      const barber = await this.barberRepo.findById(user.barberId);
      if (barber) {
        barber.active = user.active;
        await this.barberRepo.update(barber);
      }
    }

    return { user };
  }

  async listAll({ adminUser }) {
    if (!AccessControlService.canManageCredentials(adminUser)) {
      throw new Error("Acceso denegado.");
    }
    const users = await this.userRepo.findAll();
    const barbers = await this.barberRepo.findAll();
    return { users, barbers };
  }
}
