"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [errors, setErrors] = useState<{ name?: string; domain?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation matching CreateProjectSchema
    const newErrors: { name?: string; domain?: string } = {};

    if (!name.trim() || name.length > 100) {
      newErrors.name = "Name is required and must be 100 characters or fewer.";
    }

    if (!domain.trim()) {
      newErrors.domain = "Domain is required.";
    } else {
      // Validate URL format (auto-prepend https:// like the schema does)
      const normalized =
        domain.startsWith("http://") || domain.startsWith("https://")
          ? domain
          : `https://${domain}`;
      try {
        new URL(normalized);
      } catch {
        newErrors.domain = "Please enter a valid domain (e.g. example.com).";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    // TODO: Call API to create project
    // const response = await apiClient.post("/projects", { name, domain });
    // router.push(`/dashboard/projects/${response.id}`);

    // For now, redirect back to the projects list
    router.push("/dashboard/projects");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Project</h1>
        <p className="mt-1 text-muted-foreground">
          Add a website to audit for AI-readiness.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name field */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Project Name
          </label>
          <input
            id="name"
            type="text"
            placeholder="My Website"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Domain field */}
        <div className="space-y-2">
          <label
            htmlFor="domain"
            className="text-sm font-medium text-foreground"
          >
            Domain
          </label>
          <input
            id="domain"
            type="text"
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {errors.domain && (
            <p className="text-sm text-destructive">{errors.domain}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Enter the root domain to audit. https:// will be added automatically
            if omitted.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
