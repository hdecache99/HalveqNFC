import type { Dispatch, SetStateAction } from 'react'
import type { Invitation, LinkClick, LinktreeProfile, ManagedLink, Member, NfcTag, Role, Scan, Session, ViewKey, Workspace, WorkspaceSummary } from './types'

export type AppContext = {
  session: Session
  workspace: Workspace
  role: Role
  storeId: string | null
  workspaces: WorkspaceSummary[]
  tags: NfcTag[]
  setTags: Dispatch<SetStateAction<NfcTag[]>>
  profiles: LinktreeProfile[]
  setProfiles: Dispatch<SetStateAction<LinktreeProfile[]>>
  links: ManagedLink[]
  setLinks: Dispatch<SetStateAction<ManagedLink[]>>
  scans: Scan[]
  clicks: LinkClick[]
  members: Member[]
  setMembers: Dispatch<SetStateAction<Member[]>>
  invitations: Invitation[]
  setInvitations: Dispatch<SetStateAction<Invitation[]>>
  setWorkspace: (workspace: Workspace) => void
  setSessionName: (name: string) => void
  notify: (message: string) => void
  go: (view: ViewKey) => void
  enterWorkspace: (workspaceId: string) => void
  refreshWorkspaces: () => Promise<void>
}

export const isAdmin = (app: AppContext) => app.role === 'Administrador' || app.session.isPlatformAdmin
