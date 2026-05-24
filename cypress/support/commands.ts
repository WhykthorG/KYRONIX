type TestRole = 'admin' | 'teacher' | 'student' | 'coordinator' | 'secretary';

type Credentials = {
  email: string;
  password: string;
};

const ROLE_ENV_KEYS: Record<TestRole, { email: string; password: string }> = {
  admin: { email: 'adminEmail', password: 'adminPassword' },
  teacher: { email: 'teacherEmail', password: 'teacherPassword' },
  student: { email: 'studentEmail', password: 'studentPassword' },
  coordinator: { email: 'coordinatorEmail', password: 'coordinatorPassword' },
  secretary: { email: 'secretaryEmail', password: 'secretaryPassword' },
};

function getCredentials(role: TestRole): Credentials {
  const envKeys = ROLE_ENV_KEYS[role];
  return {
    email: String(Cypress.env(envKeys.email)),
    password: String(Cypress.env(envKeys.password)),
  };
}

function completeFirstAccessIfNeeded(password: string) {
  cy.get('body').then(($body) => {
    if (!$body.text().includes('Bem-vindo ao Project WG!')) {
      return;
    }

    cy.contains('button', 'Definir nova senha').click();
    cy.get('input[type="password"]').first().clear().type(password, { log: false });
    cy.get('input[type="password"]').eq(1).clear().type(password, { log: false });
    cy.contains('button', 'Salvar senha').click();
    cy.contains('button', 'Entrar no sistema').click();
  });
}

function closeStartMenuIfOpen() {
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="start-menu"]').length === 0) {
      return;
    }

    cy.get('body').type('{esc}');
    cy.get('[data-cy="start-menu"]', { timeout: 10_000 }).should('not.exist');
  });
}

declare global {
  namespace Cypress {
    interface Chainable {
      loginAs(role?: TestRole): Chainable<void>;
      completeFirstAccessIfNeeded(password: string): Chainable<void>;
      openStartMenu(): Chainable<void>;
      closeStartMenu(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('completeFirstAccessIfNeeded', (password: string) => {
  completeFirstAccessIfNeeded(password);
});

Cypress.Commands.add('closeStartMenu', () => {
  closeStartMenuIfOpen();
});

Cypress.Commands.add('openStartMenu', () => {
  closeStartMenuIfOpen();
  cy.get('[data-cy="taskbar-start"]', { timeout: 45_000 })
    .should('be.visible')
    .click();
  cy.get('[data-cy="start-menu"]', { timeout: 30_000 }).should('be.visible');
});

Cypress.Commands.add('loginAs', (role: TestRole = 'admin') => {
  const { email, password } = getCredentials(role);

  cy.visit('/login');
  cy.get('[data-cy="login-email"]').clear().type(email);
  cy.get('[data-cy="login-password"]').clear().type(password, { log: false });
  cy.get('[data-cy="login-submit"]').click();
  completeFirstAccessIfNeeded(password);
  cy.window().then((win) => {
    win.sessionStorage.removeItem('just_logged_in');
  });
  cy.location('pathname', { timeout: 45_000 }).should('not.eq', '/login');
  cy.get('[data-cy="taskbar-start"]', { timeout: 45_000 }).should('be.visible');
});

export {};
