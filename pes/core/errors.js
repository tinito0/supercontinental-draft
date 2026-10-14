// Typed errors for the PES engine. Every failure carries a stable `code` so the UI
// and tests can react to the cause instead of parsing messages.

export class PesError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PesError';
    this.code = code;
    this.details = details;
  }
}

export class PesFormatError extends PesError {
  constructor(code, message, details) {
    super(code, message, details);
    this.name = 'PesFormatError';
  }
}

export class PesValidationError extends PesError {
  constructor(code, message, details) {
    super(code, message, details);
    this.name = 'PesValidationError';
  }
}

export class PesPermissionError extends PesError {
  constructor(code, message, details) {
    super(code, message, details);
    this.name = 'PesPermissionError';
  }
}
