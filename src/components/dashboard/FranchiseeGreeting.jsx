function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function FranchiseeGreeting({ userName, franchiseName }) {
  const firstName = userName?.split(" ")[0] || "Franqueado";
  const initials = userName
    ? userName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "FR";

  return (
    <section className="mb-6">
      <h2 className="text-2xl font-bold text-[#1d1b1b]">
        {getGreeting()}, {firstName}!
      </h2>
      {franchiseName && (
        <p className="text-sm text-[#4a3d3d]">{franchiseName}</p>
      )}
    </section>
  );
}
