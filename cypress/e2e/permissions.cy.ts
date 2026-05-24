describe('Project WG - permissões e acesso', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('não expõe módulos administrativos para professores', () => {
    cy.loginAs('teacher');

    cy.openStartMenu();
    cy.contains('button', 'Usuários').should('not.exist');
    cy.contains('button', 'Configurações').should('not.exist');
    cy.contains('button', 'Portal Prof.').should('not.exist');
  });
});
