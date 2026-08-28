export class ErroDeNegocio extends Error {
  constructor(mensagem: string, public status: number = 400) {
    super(mensagem);
    this.name = 'ErroDeNegocio';
  }
}
