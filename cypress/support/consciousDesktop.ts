import { canAccessPage } from '../../src/lib/contracts/access.js';

export type TestRole =
  | 'admin'
  | 'teacher'
  | 'student'
  | 'coordinator'
  | 'secretary';

type ProfileType =
  | 'administrador'
  | 'professor'
  | 'aluno'
  | 'coordenador'
  | 'secretario';

type AppMeta = {
  id: string;
  page: string;
  title: string;
};

export const APP_CATALOG: readonly AppMeta[] = [
  { id: 'dashboard', page: 'Dashboard', title: 'Dashboard' },
  { id: 'students', page: 'Students', title: 'Alunos' },
  { id: 'teachers', page: 'Teachers', title: 'Professores' },
  { id: 'classes', page: 'Classes', title: 'Turmas' },
  { id: 'subjects', page: 'Subjects', title: 'Disciplinas' },
  { id: 'grades', page: 'Grades', title: 'Notas' },
  { id: 'attendance', page: 'Attendance', title: 'Chamada' },
  { id: 'assignments', page: 'Assignments', title: 'Atividades' },
  { id: 'schoolcalendar', page: 'SchoolCalendar', title: 'Cal. Escolar' },
  { id: 'teachercalendar', page: 'TeacherCalendar', title: 'Cal. Professor' },
  { id: 'scheduleplanner', page: 'SchedulePlanner', title: 'Horários' },
  { id: 'messages', page: 'Messages', title: 'Comunicados' },
  { id: 'calls', page: 'Calls', title: 'Ligações' },
  { id: 'library', page: 'LibraryPage', title: 'Biblioteca' },
  { id: 'reports', page: 'Reports', title: 'Relatórios' },
  { id: 'occurrences', page: 'Occurrences', title: 'Ocorrências' },
  { id: 'diary', page: 'Diary', title: 'Diário' },
  { id: 'goals', page: 'StudentGoals', title: 'Metas' },
  { id: 'guardianportal', page: 'GuardianPortal', title: 'Portal Resp.' },
  { id: 'teacherportal', page: 'TeacherPortal', title: 'Portal Prof.' },
  { id: 'academicrecord', page: 'AcademicRecord', title: 'Reg. Acadêmico' },
  { id: 'teacherhomework', page: 'TeacherHomework', title: 'Tarefas Prof.' },
  { id: 'studenthomework', page: 'StudentHomework', title: 'Minhas Tarefas' },
  { id: 'registration', page: 'Registration', title: 'Cadastro' },
  { id: 'users', page: 'UserManagement', title: 'Usuários' },
  { id: 'settings', page: 'SettingsPage', title: 'Configurações' },
] as const;

const APP_BY_ID = Object.fromEntries(
  APP_CATALOG.map((app) => [app.id, app])
) as Record<string, AppMeta>;

const ROLE_TO_PROFILE_TYPE: Record<TestRole, ProfileType> = {
  admin: 'administrador',
  teacher: 'professor',
  student: 'aluno',
  coordinator: 'coordenador',
  secretary: 'secretario',
};

export const ROLE_SMOKE_APPS: Record<TestRole, string[]> = {
  admin: ['dashboard', 'students', 'settings'],
  teacher: ['grades', 'teacherportal', 'teacherhomework'],
  student: ['grades', 'goals', 'studenthomework'],
  coordinator: ['dashboard', 'scheduleplanner', 'users'],
  secretary: ['dashboard', 'registration', 'reports'],
};

export function getAppMeta(appId: string): AppMeta {
  const app = APP_BY_ID[appId];

  if (!app) {
    throw new Error(`App desconhecido no apoio de testes: ${appId}`);
  }

  return app;
}

export function getExpectedAppIdsForRole(role: TestRole): string[] {
  const profileType = ROLE_TO_PROFILE_TYPE[role];

  return APP_CATALOG
    .filter((app) => canAccessPage(profileType, app.page))
    .map((app) => app.id)
    .sort();
}

export function revealAllAppsInStartMenu() {
  cy.openStartMenu();
  cy.get('[data-cy="start-menu-search"]').should('be.visible').clear();
  cy.get('body').then(($body) => {
    const toggleAllApps = $body.find('[data-cy="start-menu-toggle-all-apps"]').first();

    if (toggleAllApps.length > 0) {
      cy.wrap(toggleAllApps).click();
    }
  });
}

export function collectVisibleStartMenuAppIds(): Cypress.Chainable<string[]> {
  return cy
    .get('[data-cy="start-menu-app-open"]')
    .should('have.length.at.least', 1)
    .then(($buttons) => {
      const ids = Array.from(
        new Set(
          $buttons
            .toArray()
            .map((button) => button.getAttribute('data-app-id') || '')
            .filter(Boolean)
        )
      );

      return ids.sort();
    });
}

export function assertRoleDesktopAccess(role: TestRole) {
  const expectedAppIds = getExpectedAppIdsForRole(role);

  revealAllAppsInStartMenu();
  collectVisibleStartMenuAppIds().then((actualAppIds) => {
    expect(actualAppIds, `apps visíveis para ${role}`).to.deep.equal(expectedAppIds);
  });
}

export function openAppFromStartMenu(appId: string) {
  const app = getAppMeta(appId);

  cy.openStartMenu();
  cy.get('[data-cy="start-menu-search"]').should('be.visible').clear().type(app.title);
  cy.get(`[data-cy="start-menu-app-open"][data-app-id="${appId}"]`)
    .first()
    .should('be.visible')
    .click();
}

function getWindowByTitle(title: string) {
  return cy
    .get('[data-window-title]', { timeout: 45_000 })
    .filter((_, element) => element.getAttribute('data-window-title') === title)
    .last();
}

export function assertAppWindowLoaded(appId: string) {
  const app = getAppMeta(appId);

  getWindowByTitle(app.title)
    .should('be.visible')
    .within(() => {
      cy.contains('Módulo não encontrado').should('not.exist');
      cy.contains('Oops! Algo deu errado').should('not.exist');
      cy.get('.window-page-content').should('exist');
    });
}

export function closeAppWindow(appId: string) {
  const app = getAppMeta(appId);

  getWindowByTitle(app.title).within(() => {
    cy.get('button[title="Fechar"]').last().click({ force: true });
  });

  cy.get('[data-window-title]')
    .filter((_, element) => element.getAttribute('data-window-title') === app.title)
    .should('not.exist');
}
