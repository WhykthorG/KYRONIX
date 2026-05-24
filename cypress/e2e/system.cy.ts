// P├Âr├Âjek ╔øm╔ø cua lat k╔ø╔øliw ╔ø Whykthor GSV.
type MenuModule = {
  title: string;
  expectedTitle: string | RegExp;
};

const ADMIN_MODULES: MenuModule[] = [
  { title: 'Dashboard', expectedTitle: 'Dashboard' },
  { title: 'Alunos', expectedTitle: 'Alunos' },
  { title: 'Professores', expectedTitle: 'Professores' },
  { title: 'Turmas', expectedTitle: 'Turmas' },
  { title: 'Disciplinas', expectedTitle: 'Disciplinas' },
  { title: 'Notas', expectedTitle: 'Lançamento de Notas' },
  { title: 'Chamada', expectedTitle: 'Chamada Diaria' },
  { title: 'Atividades', expectedTitle: 'Atividades' },
  { title: 'Cal. Escolar', expectedTitle: 'Calendário Escolar' },
  { title: 'Cal. Professor', expectedTitle: 'Calendário do Professor' },
  { title: 'Horários', expectedTitle: 'Módulo de Horários' },
  { title: 'Comunicados', expectedTitle: 'Comunicados' },
  { title: 'Biblioteca', expectedTitle: 'Biblioteca' },
  { title: 'Relatórios', expectedTitle: /Relat[oó]rios/ },
  { title: 'Ocorrências', expectedTitle: 'Ocorrências' },
  { title: 'Diário', expectedTitle: 'Diário Eletrônico' },
  { title: 'Portal Prof.', expectedTitle: /Painel Administrativo|Portal do Professor/ },
  { title: 'Reg. Acadêmico', expectedTitle: 'Registro Acadêmico' },
  { title: 'Tarefas Prof.', expectedTitle: 'Tarefas de Casa' },
  { title: 'Minhas Tarefas', expectedTitle: 'Minhas Tarefas de Casa' },
  { title: 'Cadastro', expectedTitle: 'Cadastros' },
  { title: 'Usuários', expectedTitle: 'Gestão de Usuários' },
  { title: 'Configurações', expectedTitle: 'Configurações' },
];

function loginAdminViaUi() {
  cy.loginAs('admin');
}

function openStartMenuModule(module: MenuModule) {
  cy.openStartMenu();
  cy.get('[data-cy="start-menu"]', { timeout: 30_000 })
    .contains('button', module.title)
    .scrollIntoView()
    .click();

  cy.get('[data-cy="page-title"]', { timeout: 30_000 })
    .should('exist')
    .invoke('text')
    .then((text) => {
      const titleText = text.trim();

      if (module.expectedTitle instanceof RegExp) {
        expect(titleText).to.match(module.expectedTitle);
        return;
      }

      expect(titleText).to.include(module.expectedTitle);
    });
}

describe('Project WG - sistema inteiro como admin', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('navega pelos módulos administrativos apenas com cliques', () => {
    loginAdminViaUi();

    cy.openStartMenu();
    cy.get('[data-cy="start-menu"]')
      .contains('button', 'Portal Resp.')
      .should('not.exist');
    cy.get('[data-cy="start-menu"]')
      .contains('button', 'Metas')
      .should('not.exist');
    cy.closeStartMenu();

    ADMIN_MODULES.forEach((module) => {
      openStartMenuModule(module);
    });
  });
});

export {};
