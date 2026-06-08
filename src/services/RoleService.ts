import { authService } from './AuthService';

export type UserRole = 'ADMIN' | 'TEAM_MEMBER';

export interface UserPermissions {
  role: UserRole;
  teamId?: string; // Team 01 - Team 15
  accessibleTurbines: string[]; // Specific serial numbers if restricted
  canEditInventory: boolean;
  canViewAllTeams: boolean;
}

class RoleService {
  /**
   * Defines the security logic for 15 teams and admins.
   * This is used by other services to filter queries before sending to Firestore.
   */
  async getUserPermissions(): Promise<UserPermissions> {
    const user = authService.getCurrentUser();
    
    if (!user) {
      return {
        role: 'TEAM_MEMBER',
        accessibleTurbines: [],
        canEditInventory: false,
        canViewAllTeams: false
      };
    }

    // Logic: Admin check (fatih.zebek@demirerholding.com or specific emails)
    const isAdmin = user.email?.toLowerCase().includes('admin') || 
                    user.email === 'fatih.zebek@demirerholding.com';

    if (isAdmin) {
      return {
        role: 'ADMIN',
        canEditInventory: true,
        canViewAllTeams: true,
        accessibleTurbines: ['*'] // Global access
      };
    }

    // Logic for Team 01 - Team 15
    // We derive the teamId from user profile or email pattern
    const teamMatch = user.email?.match(/team(\d+)/i);
    const teamId = teamMatch ? `Team ${teamMatch[1].padStart(2, '0')}` : 'Unknown';

    return {
      role: 'TEAM_MEMBER',
      teamId: teamId,
      canEditInventory: false,
      canViewAllTeams: false,
      accessibleTurbines: [] // To be populated by Firestore team assignment doc
    };
  }

  /**
   * Helper to determine if the current user can see a specific document
   */
  async canAccessDocument(docTeamId: string): Promise<boolean> {
    const perms = await this.getUserPermissions();
    if (perms.role === 'ADMIN') return true;
    return perms.teamId === docTeamId;
  }

  /**
   * Generates a Firestore query filter based on user role
   * For Team members, this ensures they only see their own work.
   */
  async getAccessFilter() {
    const perms = await this.getUserPermissions();
    if (perms.canViewAllTeams) return {}; // No filter for Admins
    return { field: 'teamId', op: '==', value: perms.teamId };
  }
}

export const roleService = new RoleService();
