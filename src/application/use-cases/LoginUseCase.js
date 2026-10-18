/**
 * Caso de Uso: Autenticación de Usuarios
 * Capa 3: Application Services
 */
export class LoginUseCase {
  constructor({ userRepo, barberRepo }) {
    this.userRepo = userRepo;
    this.barberRepo = barberRepo;
  }

  async execute({ username, password }) {
    if (!username || !password) {
      throw new Error("Debe ingresar usuario y contraseña.");
    }

    const user = await this.userRepo.findByUsername(username.toLowerCase().trim());
    if (!user || !user.active) {
      throw new Error("Credenciales inválidas o usuario inactivo.");
    }

    // Validación segura de credencial
    const isValid = await this.userRepo.verifyPassword(user, password);
    if (!isValid) {
      throw new Error("Credenciales inválidas.");
    }

    let barber = null;
    if (user.barberId) {
      barber = await this.barberRepo.findById(user.barberId);
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        barberId: user.barberId
      },
      barber
    };
  }
}
