const SMOKE_ADMIN_MODULES = [
  { launcher: 'Dashboard', title: 'Dashboard' },
  { launcher: 'Alunos', title: 'Alunos' },
  { launcher: 'Configurações', title: 'Configurações' },
  { launcher: 'Usuários', title: 'Gestão de Usuários' },
];

function openModule(launcher: string, title: string) {
  cy.openStartMenu();
  cy.get('[data-cy="start-menu"]').then(($menu) => {
    const directButton = $menu
      .find('button')
      .filter((_, element) => (element.textContent || '').includes(launcher))
      .first();

    if (directButton.length > 0) {
      cy.wrap(directButton).scrollIntoView().click();
      return;
    }

    cy.get('#start-menu-search').clear().type(launcher);
    cy.get('[data-cy="start-menu"]')
      .contains('button', launcher, { matchCase: false })
      .scrollIntoView()
      .click();
  });
  cy.get('[data-window-title]', { timeout: 30_000 })
    .filter((_, element) => {
      const windowTitle = element.getAttribute('data-window-title') || '';
      const contentText = (element.textContent || '').trim();
      return windowTitle.includes(title) || contentText.includes(title);
    })
    .last()
    .find('[data-cy="page-title"]', { timeout: 30_000 })
    .should('contain.text', title);
}

describe('Project WG - smoke e2e', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('permite login e navegação básica no desktop', () => {
    cy.loginAs('admin');

    cy.get('[data-cy="taskbar-start"]').should('be.visible');
    cy.openStartMenu();
    cy.contains('button', 'Dashboard').should('be.visible');
    cy.get('[data-cy="start-menu-profile"]').should('be.visible');

    cy.get('[data-cy="start-menu-profile"]').click();
    cy.get('[role="dialog"]').should('contain.text', 'Perfil');
    cy.get('body').type('{esc}');

    cy.get('[data-cy="start-menu-logout"]').click();
    cy.location('pathname').should('eq', '/login');
    cy.get('[data-cy="login-submit"]').should('be.visible');
  });

  it('abre os módulos principais do perfil administrativo', () => {
    cy.loginAs('admin');

    SMOKE_ADMIN_MODULES.forEach(({ launcher, title }) => {
      openModule(launcher, title);
    });
  });
});

export {};
