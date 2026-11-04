
import { useState } from "react";
import { Mail, Phone, MapPin, Send } from "lucide-react";

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [notice, setNotice] = useState("");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Connect this form to Spring Boot later.
    setNotice(
      "The contact form is not connected to the server yet."
    );
  };

  return (
    <main className="min-h-screen bg-[#FFF9F3] text-[#17265B]">

      {/* PAGE HEADER */}
      <section className="bg-[#EAF0FF] px-6 py-20 text-center">
        <h1 className="font-serif text-5xl font-bold">
          Contact Us
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-gray-600">
          Have a question about our ice cream, wholesale
          orders, or delivery services? We'd love to hear
          from you.
        </p>
      </section>

      {/* CONTACT SECTION */}
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2">

        {/* CONTACT INFORMATION */}
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#3654FF]">
            Get in Touch
          </p>

          <h2 className="font-serif text-4xl font-bold">
            Let's Talk Ice Cream
          </h2>

          <p className="mt-5 leading-8 text-gray-600">
            Contact our team to ask about available
            flavours, wholesale purchasing, or general
            product information.
          </p>

          <div className="mt-10 space-y-7">
            <div className="flex items-start gap-4">
              <Mail className="text-[#3654FF]" />

              <div>
                <h3 className="font-semibold">Email</h3>
                <p className="text-gray-500">
                  Contact our team for email details.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Phone className="text-[#3654FF]" />

              <div>
                <h3 className="font-semibold">Phone</h3>
                <p className="text-gray-500">
                  Contact our team for phone details.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <MapPin className="text-[#3654FF]" />

              <div>
                <h3 className="font-semibold">Location</h3>
                <p className="text-gray-500">
                  Sri Lanka
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CONTACT FORM */}
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-bold">
            Send a Message
          </h2>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-2 block font-medium"
              >
                Full Name
              </label>

              <input
                id="name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Enter your name"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-medium"
              >
                Email Address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <div>
              <label
                htmlFor="subject"
                className="mb-2 block font-medium"
              >
                Subject
              </label>

              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={form.subject}
                onChange={handleChange}
                placeholder="Enter subject"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-2 block font-medium"
              >
                Message
              </label>

              <textarea
                id="message"
                name="message"
                rows={5}
                required
                value={form.message}
                onChange={handleChange}
                placeholder="Write your message..."
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#3654FF]"
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#3654FF] py-3 font-semibold text-white transition hover:bg-[#233BC8]"
            >
              <Send size={18} />
              Send Message
            </button>

            {notice && (
              <p role="status" className="text-sm text-gray-600">
                {notice}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
