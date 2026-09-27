import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "../types";
import { jwtDecode } from "jwt-decode";
import { api } from "../services/api";

interface AuthContextType {
  user: User | null;
  loginWithGoogleCredential: (credential: string) => Promise<void>;
  loginDemo: (name?: string, email?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("reachinbox_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Default logged in user for immediate seamless experience
    return {
      name: "Demo Candidate",
      email: "candidate@reachinbox.ai",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ReachInbox",
    };
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("reachinbox_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("reachinbox_user");
    }
  }, [user]);

  const loginWithGoogleCredential = async (credential: string) => {
    try {
      const decoded: any = jwtDecode(credential);
      const newUser: User = {
        name: decoded.name || decoded.email,
        email: decoded.email,
        avatarUrl: decoded.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${decoded.email}`,
      };

      await api.syncUser({
        name: newUser.name,
        email: newUser.email,
        avatarUrl: newUser.avatarUrl,
        googleId: decoded.sub,
      });

      setUser(newUser);
    } catch (err) {
      console.error("Failed to decode Google JWT:", err);
      throw err;
    }
  };

  const loginDemo = async (
    name = "ReachInbox Admin",
    email = "admin@reachinbox.ai"
  ) => {
    const newUser: User = {
      name,
      email,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    };
    await api.syncUser({
      name: newUser.name,
      email: newUser.email,
      avatarUrl: newUser.avatarUrl,
    });
    setUser(newUser);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithGoogleCredential,
        loginDemo,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
