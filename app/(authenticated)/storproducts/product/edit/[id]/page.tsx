// app/(authenticated)/storproducts/products/edit/[id]/page.tsx
/* eslint-disable */
import EditProducts from "../../../_components/EditProduct";

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      <EditProducts id={params.id} />
    </div>
  );
}
