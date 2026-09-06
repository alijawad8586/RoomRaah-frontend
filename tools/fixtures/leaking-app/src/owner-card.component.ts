export interface OwnerCard {
  ownerDisplayName: string;
  ownerPhone: string;
  ownerEmail: string;
}

export function callOwner(owner: OwnerCard): void {
  window.location.href = 'mailto:' + owner.ownerEmail;
}
