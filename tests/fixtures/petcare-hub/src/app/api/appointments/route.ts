// BAD: copy-pasted validation and error handling from pets/route.ts
// BAD: direct Prisma usage, no service layer
// BAD: mixed concerns — email sending, validation, DB calls all in one handler

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

// BAD: another PrismaClient instance (there are 3 total across route files)
const prisma = new PrismaClient();

// BAD: email transporter initialized at module level on every cold start
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendAppointmentConfirmation(
  email: string,
  petName: string,
  scheduledAt: string,
  vetName: string
) {
  // BAD: email logic inline in the route file, not in a service
  try {
    await transporter.sendMail({
      from: `"PetCare Hub" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Appointment Confirmed for ${petName}`,
      html: `
        <h2>Your appointment is confirmed!</h2>
        <p>Pet: <strong>${petName}</strong></p>
        <p>Vet: <strong>${vetName}</strong></p>
        <p>Date: <strong>${new Date(scheduledAt).toLocaleString()}</strong></p>
        <p>Thank you for using PetCare Hub!</p>
      `,
    });
  } catch (err) {
    // BAD: silently swallowing email errors
    console.error("Failed to send confirmation email:", err);
  }
}

// GET /api/appointments
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get("upcoming") === "true";
    const petId = searchParams.get("petId");
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");

    // BAD: building where clause with excessive any types
    const where: any = {};
    if (upcoming) {
      where.scheduledAt = { gte: new Date() };
      where.status = { notIn: ["cancelled", "completed"] };
    }
    if (petId) where.petId = petId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { scheduledAt: "asc" },
      take: limit,
      include: {
        pet: { select: { id: true, name: true, species: true, imageUrl: true } },
        user: { select: { id: true, name: true, email: true } }, // BAD: exposing email
      },
    });

    // BAD: transforming data in a confusing way
    const transformed = appointments.map((appt) => ({
      ...appt,
      petName: (appt as any).pet?.name,
      ownerEmail: (appt as any).user?.email,
      // BAD: using string concatenation for date display
      displayDate: new Date(appt.scheduledAt).toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }) + " at " + new Date(appt.scheduledAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return NextResponse.json({ appointments: transformed, total: appointments.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/appointments
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // BAD: manual validation duplicated from dashboard component (3rd occurrence)
    if (!body.petId) return NextResponse.json({ error: "Pet ID required" }, { status: 400 });
    if (!body.scheduledAt) return NextResponse.json({ error: "Scheduled time required" }, { status: 400 });
    if (!body.vetName?.trim()) return NextResponse.json({ error: "Vet name required" }, { status: 400 });

    const scheduledAt = new Date(body.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (scheduledAt < new Date()) {
      return NextResponse.json({ error: "Cannot book appointments in the past" }, { status: 400 });
    }

    // BAD: N+1 — fetching pet to get owner email for notification
    const pet = await prisma.pet.findUnique({
      where: { id: body.petId },
      include: { owner: { select: { email: true, name: true } } },
    });

    if (!pet) {
      return NextResponse.json({ error: "Pet not found" }, { status: 404 });
    }

    // BAD: check for conflicting appointments with inefficient query
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        petId: body.petId,
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - 30 * 60 * 1000), // 30 min before
          lte: new Date(scheduledAt.getTime() + 30 * 60 * 1000), // 30 min after
        },
        status: { notIn: ["cancelled"] },
      },
    });

    if (conflictingAppointment) {
      return NextResponse.json({
        error: "This pet already has an appointment within 30 minutes of this time"
      }, { status: 409 });
    }

    // BAD: userId hardcoded — no auth
    const userId = body.userId || "00000000-0000-0000-0000-000000000000";

    const appointment = await prisma.appointment.create({
      data: {
        petId: body.petId,
        userId,
        type: body.type || "checkup",
        vetName: body.vetName.trim(),
        clinicName: body.clinicName?.trim() || null,
        scheduledAt,
        duration: body.duration || 30,
        notes: body.notes?.trim() || null,
        cost: body.cost ? Number(body.cost) : null,
        isVirtual: body.isVirtual || false,
        status: "pending",
      },
    });

    // BAD: sending email synchronously blocks the response
    if ((pet as any).owner?.email) {
      await sendAppointmentConfirmation(
        (pet as any).owner.email,
        pet.name,
        scheduledAt.toISOString(),
        body.vetName
      );
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/appointments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/appointments — for status updates, cancellations
export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const body = await req.json();

    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // BAD: state machine logic inline with no validation of valid transitions
    if (body.status === "cancelled" && existing.status === "completed") {
      return NextResponse.json({ error: "Cannot cancel a completed appointment" }, { status: 400 });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status: body.status || existing.status,
        notes: body.notes || existing.notes,
        cost: body.cost !== undefined ? Number(body.cost) : existing.cost,
        vetName: body.vetName || existing.vetName,
        cancelledAt: body.status === "cancelled" ? new Date() : existing.cancelledAt,
        cancellationReason: body.cancellationReason || existing.cancellationReason,
        completedAt: body.status === "completed" ? new Date() : existing.completedAt,
        rating: body.rating !== undefined ? Number(body.rating) : existing.rating,
        feedback: body.feedback || existing.feedback,
      },
    });

    return NextResponse.json({ appointment });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/appointments
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // BAD: deleting instead of soft-deleting via status="cancelled"
    await prisma.appointment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
