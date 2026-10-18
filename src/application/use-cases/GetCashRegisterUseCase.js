/**
 * Caso de Uso: Consulta y Arqueo de Caja Diaria
 * Capa 3: Application Services
 */
import { AccessControlService } from '../../domain/services/AccessControlService.js';
import { CashCalculatorService } from '../../domain/services/CashCalculatorService.js';

export class GetCashRegisterUseCase {
  constructor({ historyRepo }) {
    this.historyRepo = historyRepo;
  }

  async execute({ user, dateStr }) {
    if (!AccessControlService.canViewCashRegister(user)) {
      throw new Error("Acceso denegado: el rol actual no tiene permisos sobre la caja.");
    }
    const historyList = await this.historyRepo.findAll();
    return CashCalculatorService.calculateDailyCash(historyList, dateStr);
  }
}
