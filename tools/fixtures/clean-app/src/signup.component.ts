// The seeker's own phone number is collected at registration and is a legitimate field on
// the register command. It is the person's own number, not an owner's, so the contact guard
// must not flag it.
export interface RegisterForm {
  email: string;
  password: string;
  phoneNumber: string;
  displayName: string;
}
