export default function Loading() {
  return (
    <div className="tm-container section">
      <div className="skeleton mb-4 h-8 w-56" />
      <div className="grid-products">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="skeleton h-72" />
        ))}
      </div>
    </div>
  );
}
