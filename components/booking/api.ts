"use client";

/** Typed calls to the booking API routes, used by the booking flow. */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.json === undefined ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
      body: init?.json === undefined ? init?.body : JSON.stringify(init.json),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network", "You seem to be offline. Check your connection and try again.");
  }
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string; message?: string; field?: string })
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? "unknown",
      data?.message ?? "Something went wrong. Please try again.",
      data?.field,
    );
  }
  return data as T;
}

export type SlotDto = { minutes: number; label: string; startsAt: string };
export type AvailabilityDto = {
  date: string;
  durationMin: number;
  closedReason: "past" | "outside_window" | "closed" | "no_staff" | null;
  slots: SlotDto[];
};

export function fetchAvailability(params: { date: string; serviceIds: string[]; staffId: string | null }, signal?: AbortSignal) {
  const query = new URLSearchParams({ date: params.date, services: params.serviceIds.join(",") });
  if (params.staffId) query.set("staff", params.staffId);
  return request<AvailabilityDto>(`/api/bookings/availability?${query}`, { signal });
}

export type HoldDto = {
  bookingId: string;
  code: string;
  staff: { id: string; name: string };
  startsAt: string;
  endsAt: string;
  holdExpiresAt: string;
  totalPaise: number;
  amountDueNowPaise: number;
  items: { serviceId: string; name: string; pricePaise: number; durationMin: number }[];
};

export function createHold(body: {
  serviceIds: string[];
  staffId: string | null;
  date: string;
  startMinutes: number;
  customer: { name: string; phone: string; email: string };
  notes: string;
}) {
  return request<HoldDto>("/api/bookings/hold", { method: "POST", json: body });
}

export type OrderDto =
  | {
      kind: "order";
      code: string;
      orderId: string;
      amountPaise: number;
      keyId: string;
      prefill: { name: string; contact: string | null; email: string | null };
    }
  | { kind: "confirmed"; code: string };

export function startPayment(bookingId: string) {
  return request<OrderDto>("/api/payments/order", { method: "POST", json: { bookingId } });
}

export type VerifyDto = {
  status: "confirmed" | "already_confirmed" | "processing" | "failed" | "needs_review" | "unknown_order";
  code: string | null;
  message: string;
};

export function verifyPayment(body: { orderId: string; paymentId: string; signature: string }) {
  return request<VerifyDto>("/api/payments/verify", {
    method: "POST",
    json: {
      razorpay_order_id: body.orderId,
      razorpay_payment_id: body.paymentId,
      razorpay_signature: body.signature,
    },
  });
}
