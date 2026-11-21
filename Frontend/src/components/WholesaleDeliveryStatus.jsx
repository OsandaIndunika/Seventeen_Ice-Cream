
import React from "react";
import {
  Clock3,
  Package,
  Truck,
  CheckCircle2,
} from "lucide-react";

const steps = [
  {
    status: "WAITING",
    label: "Waiting",
    icon: Clock3,
    description: "Your order is waiting for a delivery vehicle.",
  },
  {
    status: "PROCESSING",
    label: "Processing",
    icon: Package,
    description: "A delivery vehicle has accepted your order.",
  },
  {
    status: "ON_THE_WAY",
    label: "On the Way",
    icon: Truck,
    description: "Your order is on its way to your shop.",
  },
  {
    status: "DELIVERED",
    label: "Delivered",
    icon: CheckCircle2,
    description: "Your order has been delivered.",
  },
];

export default function WholesaleDeliveryStatus({
  status = "WAITING",
  vehicleNumber,
}) {
  const currentIndex = steps.findIndex(
    (step) => step.status === status
  );

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="mb-5 text-xl font-bold text-[#17265B]">
        Delivery Tracking
      </h3>

      <div className="space-y-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const completed = index <= currentIndex;

          return (
            <div
              key={step.status}
              className="flex items-start gap-4"
            >
              <div
                className={`rounded-full p-3 ${
                  completed
                    ? "bg-[#3654FF] text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon size={20} />
              </div>

              <div>
                <p
                  className={`font-semibold ${
                    completed
                      ? "text-[#17265B]"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </p>

                {index === currentIndex && (
                  <p className="mt-1 text-sm text-gray-500">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {vehicleNumber && (
        <p className="mt-6 rounded-xl bg-blue-50 p-4 text-sm">
          Assigned Delivery Vehicle:{" "}
          <strong>{vehicleNumber}</strong>
        </p>
      )}
    </div>
  );
}
