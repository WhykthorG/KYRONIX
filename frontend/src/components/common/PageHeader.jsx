import React from 'react';
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissions } from '@/components/hooks/usePermissions';
import { canAccessDashboard as canAccessDashboardByPermission } from '@shared/contracts/access';

export default function PageHeader({ 
  title, 
  subtitle, 
  action, 
  actionLabel = "Novo", 
  actionIcon: ActionIcon = Plus,
  // Back button props
  backTo,        // route string e.g. '/Dashboard' — uses navigate()
  backAction,    // function — called when back is clicked (for internal state reset)
  backLabel = "Voltar",
  children 
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profileType } = usePermissions();

  const canAccessDashboard = canAccessDashboardByPermission(profileType);
  const cameFromDashboard = Boolean(
    location.state?.fromDashboard || sessionStorage.getItem('route_previous') === '/Dashboard'
  );
  const canShowDashboardBack = backTo !== '/Dashboard' || (canAccessDashboard && cameFromDashboard);

  const handleBack = () => {
    if (backAction) {
      backAction();
    } else if (backTo) {
      navigate(backTo);
    } else {
      window.history.back();
    }
  };

  const showBack = !!(backTo || backAction) && canShowDashboardBack;

  return (
    <div className="app-page-header" data-cy="page-header">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {showBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="-ml-1 mt-0.5 gap-1.5 rounded-full px-3 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Button>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/80">
            Workspace
          </p>
          <h1 className="mt-2 text-2xl font-bold text-foreground md:text-3xl" data-cy="page-title">{title}</h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {children}
        {action && (
          <Button onClick={action}>
            <ActionIcon className="w-4 h-4 mr-2" />
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
