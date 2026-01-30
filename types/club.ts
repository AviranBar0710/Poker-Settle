// Club data model
export type Club = {
  id: string
  name: string
  slug: string
  joinCode?: string | null
  createdBy?: string | null
  createdAt: string
}

// Club member data model
export type ClubMember = {
  clubId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  createdAt: string
}

// Club with membership info
export type ClubWithMembership = Club & {
  role: 'owner' | 'admin' | 'member'
}

