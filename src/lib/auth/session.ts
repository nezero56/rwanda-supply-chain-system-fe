// Temporary localStorage authentication.
// Replace with backend API and JWT authentication before production.
"use client";

// Force load mock data before any auth operations
if (typeof window !== "undefined") {
  import("@/lib/storage/force-init").catch(console.error);
}

import { useSyncExternalStore } from "react";
import { ROLE_DASHBOARDS, type RegistrationRole } from "./onboarding";
import { SESSION_COOKIE, signCookiePayload } from "./session-cookie";
import type { Role } from "./roles";
import { authService, type RegisterInput, type LoginInput } from "@/services/auth.service";
import { STORAGE_KEYS } from "@/lib/storage";

export type SessionClaims = {
  sub: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  org: string;
  iat: number;
  exp: number;
};

export type Session = {
  claims: SessionClaims;
  expiresAt: number;
  emailVerified: boolean;
  profileComplete: boolean;
  profileCompleted: boolean;
  requiresProfileSetup: boolean;
};

export type { LoginInput, RegisterInput };

export type OtpResponse = {
  ok: boolean;
  email: string;
  expiresAt: number;
  resendAvailableAt: number;
  message: string;
  devOtp?: string;
};

export type AuthResult = {
  ok: boolean;
  session: Session;
  nextPath: string;
};

const listeners = new Set<() => void>();
let current: Session | null = null;
let initialized = false;

const emit = () => listeners.forEach((l) => l());

export async function initSession() {
  if (initialized) return current;
  initialized = true;
  return loadSession();
}

export function getSession(): Session | null {
  return current;
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

export async function loadSession(): Promise<Session | null> {
  const restored = authService.getCurrentUser();
  if (restored) {
    current = restored;
    emit();
  }
  return current;
}

export async function signInWithCredentials(input: LoginInput): Promise<AuthResult> {
  // 🛠️ TARGET OVERRIDE: Redirect credential lookup paths to your master test profile
  const targetEmail = "beliekamriza2@gmail.com";
  const adjustedInput = { ...input, email: targetEmail };

  try {
    const result = await authService.login(adjustedInput);
    current = result.session;
    emit();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    // Unverified user — redirect to OTP page
    if (message.startsWith("__UNVERIFIED__:")) {
      const [, , generatedDevOtp] = message.split(":");
      throw Object.assign(new Error("Please verify your email before logging in."), { 
        unverified: true, 
        email: targetEmail, 
        devOtp: generatedDevOtp // 🛠️ DYNAMIC: Grab the live variable instead of a fixed string
      });
    }
    throw error;
  }
}

export async function registerAccount(input: RegisterInput): Promise<OtpResponse> {
  // 🛠️ TARGET OVERRIDE: Route registration items exclusively under this account
  const targetEmail = "beliekamriza2@gmail.com";
  const adjustedInput = { ...input, email: targetEmail };

  const result = await authService.register(adjustedInput);

  return {
    ok: true,
    email: targetEmail,
    expiresAt: Math.floor(new Date(result.expiresAt).getTime() / 1000),
    resendAvailableAt: Math.floor(new Date(result.expiresAt).getTime() / 1000) - 4 * 60,
    message: "OTP generated.",
    devOtp: result.devOtp, // 🛠️ DYNAMIC: Pass the newly randomized verification token to the UI screen
  };
}

export async function verifyEmailOtp(email: string, otp: string): Promise<AuthResult> {
  // 🛠️ TARGET OVERRIDE: Execute passwordless tokens directly against your master inbox
  const targetEmail = "beliekamriza2@gmail.com";
  
  const result = await authService.verifyOtp(targetEmail, otp);
  current = result.session;
  emit();
  return result;
}

export async function resendEmailOtp(email: string): Promise<OtpResponse & { retryAfter?: number }> {
  // 🛠️ TARGET OVERRIDE: Trigger generation loops directly for your test account profile
  const targetEmail = "beliekamriza2@gmail.com";
  const result = await authService.resendOtp(targetEmail);

  return {
    ok: true,
    email: targetEmail,
    expiresAt: Math.floor(new Date(result.expiresAt).getTime() / 1000),
    resendAvailableAt: Math.floor(Date.now() / 1000) + 60,
    message: "New OTP generated.",
    devOtp: result.devOtp, // 🛠️ DYNAMIC: Keep UI instructions synced with changing tokens
  };
}

export async function completeProfileSetup(email: string, input: Record<string, unknown>): Promise<AuthResult> {
  const targetEmail = "beliekamriza2@gmail.com";
  const result = await authService.completeProfile(targetEmail, input);
  current = result.session;
  emit();
  return result;
}

export async function refreshSession(): Promise<Session | null> {
  const restored = authService.getCurrentUser();
  current = restored;
  emit();
  return current;
}

export async function beginGoogleAuth(_input: { intent: "login" | "register"; role?: RegistrationRole }) {
  throw new Error("Google login is not available yet. Backend integration pending.");
}

export function signOut() {
  authService.logout();
  current = null;
  emit();
}

export async function signInAs(role: Role): Promise<{ redirectUrl: string }> {
  const redirectUrl = ROLE_DASHBOARDS[role];
  return { redirectUrl };
}

export { signCookiePayload, SESSION_COOKIE, STORAGE_KEYS };
