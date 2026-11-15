"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * DESIGN.md §5 Inputs (app) and §11.5 (public / booking).
 * Public inputs are 16px so iOS Safari doesn't zoom on focus.
 */
export const inputVariants = cva(
  [
    "w-full min-w-0 border border-line bg-surface text-ink outline-none transition",
    "placeholder:text-muted/70",
    "focus:border-accent focus:ring-3 focus:ring-accent/15",
    "disabled:bg-canvas disabled:text-muted disabled:cursor-not-allowed",
    "aria-invalid:border-danger aria-invalid:focus:ring-danger/15",
  ],
  {
    variants: {
      size: {
        app: "h-8 rounded-lg px-2.5 text-[13px]",
        "app-lg": "h-9 rounded-lg px-3 text-[13px]",
        /** Inline table edit (§5 `.input-sm`). */
        inline:
          "h-7 rounded-md border-transparent bg-transparent px-1.5 text-xs hover:border-line focus:bg-surface",
        public: "h-12 rounded-xl px-4 text-[16px]",
      },
    },
    defaultVariants: { size: "app" },
  },
);

type InputVariant = VariantProps<typeof inputVariants>;

/* ---------- Field: wires label, hint and error to the control by id ---------- */

type FieldCtx = { id: string; hintId?: string; errorId?: string; invalid: boolean; size: "app" | "public" };
const FieldContext = createContext<FieldCtx | null>(null);

export function Field({
  label,
  hint,
  error,
  size = "app",
  className,
  children,
  required,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: "app" | "public";
  className?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const pub = size === "public";

  return (
    <FieldContext.Provider value={{ id, hintId, errorId, invalid: Boolean(error), size }}>
      <div className={className}>
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "block font-medium",
              pub ? "mb-1.5 text-[14px] text-ink" : "mb-1 text-xs text-muted",
            )}
          >
            {label}
            {required && (
              <span aria-hidden className="ml-0.5 text-accent">
                *
              </span>
            )}
          </label>
        )}
        {children}
        {error ? (
          <p id={errorId} role="alert" className={cn("text-danger", pub ? "mt-1.5 text-[14px]" : "mt-1 text-xs")}>
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className={cn("text-muted", pub ? "mt-1.5 text-[14px]" : "mt-1 text-xs")}>
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: ComponentProps<"input">["aria-invalid"] }) {
  const field = useContext(FieldContext);
  if (!field) return { props: {}, size: undefined };
  const describedBy = [props["aria-describedby"], field.errorId ?? field.hintId].filter(Boolean).join(" ") || undefined;
  return {
    props: {
      id: props.id ?? field.id,
      "aria-describedby": describedBy,
      "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    },
    size: field.size,
  };
}

/* ---------- Controls ---------- */

export type InputProps = Omit<ComponentProps<"input">, "size"> & InputVariant & { prefix?: ReactNode };

export function Input({ className, size, prefix, ...props }: InputProps) {
  const field = useFieldProps(props);
  const resolvedSize = size ?? field.size ?? "app";
  const input = (
    <input className={cn(inputVariants({ size: resolvedSize }), prefix ? "pl-14" : null, className)} {...props} {...field.props} />
  );
  if (!prefix) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center border-r border-line text-muted">
        {prefix}
      </span>
      {input}
    </div>
  );
}

export type TextareaProps = ComponentProps<"textarea"> & InputVariant;

export function Textarea({ className, size, rows = 3, ...props }: TextareaProps) {
  const field = useFieldProps(props);
  const resolvedSize = size ?? field.size ?? "app";
  return (
    <textarea
      rows={rows}
      className={cn(inputVariants({ size: resolvedSize }), "h-auto resize-y", resolvedSize === "public" ? "py-3" : "py-1.5", className)}
      {...props}
      {...field.props}
    />
  );
}

export type NativeSelectProps = Omit<ComponentProps<"select">, "size"> & InputVariant;

/** Native select: best on phones (OS picker). Use the Radix menu only when you need rich options. */
export function NativeSelect({ className, size, children, ...props }: NativeSelectProps) {
  const field = useFieldProps(props);
  const resolvedSize = size ?? field.size ?? "app";
  return (
    <select
      className={cn(
        inputVariants({ size: resolvedSize }),
        "appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-8",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235f6672' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
      {...field.props}
    >
      {children}
    </select>
  );
}
