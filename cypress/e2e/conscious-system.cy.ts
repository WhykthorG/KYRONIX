// Bu proje tamamen Whykthor GSV taraf─▒ndan yap─▒lm─▒┼ƒt─▒r.
import {
  assertAppWindowLoaded,
  assertRoleDesktopAccess,
  closeAppWindow,
  openAppFromStartMenu,
  ROLE_SMOKE_APPS,
  type TestRole,
} from '../support/consciousDesktop';

const TEST_ROLES: readonly TestRole[] = [
  'admin',
  'teacher',
  'student',
  'coordinator',
  'secretary',
];

describe('Project WG - automação consciente do sistema', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('protege o formulário de login e expõe a recuperação de senha', () => {
    cy.visit('/login');
    cy.get('[data-cy="login-submit"]').click();
    cy.contains('Preencha e-mail e senha.').should('be.visible');

    cy.get('[data-cy="login-reset-toggle"]').click();
    cy.get('[data-cy="login-reset-email"]').should('be.visible');
    cy.get('[data-cy="login-reset-submit"]').should('contain.text', 'Enviar link de redefinição');
  });

  TEST_ROLES.forEach((role) => {
    it(`alinha o desktop do perfil ${role} com o contrato de acesso`, () => {
      cy.loginAs(role);
      assertRoleDesktopAccess(role);
      cy.closeStartMenu();

      ROLE_SMOKE_APPS[role].forEach((appId) => {
        openAppFromStartMenu(appId);
        assertAppWindowLoaded(appId);
        closeAppWindow(appId);
      });

      cy.openStartMenu();
      cy.get('[data-cy="start-menu-profile"]').should('be.visible');
      cy.get('[data-cy="start-menu-logout"]').click();
      cy.location('pathname', { timeout: 45_000 }).should('eq', '/login');
    });
  });
});

export {};
