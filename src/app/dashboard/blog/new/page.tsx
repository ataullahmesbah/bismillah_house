import { PageHeader } from "@/components/ui";
import { requirePermissionPage } from "@/lib/auth/guards";
import { userHasPermission } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";

import { BlogTabs } from "../nav";
import { BlogPostForm } from "../post-form";

export const dynamic = "force-dynamic";

export default async function NewBlogPostPage() {
  const user = await requirePermissionPage(PERMISSIONS.BLOG_WRITE);
  const [categories, mayPublish] = await Promise.all([
    prisma.blogCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
    }),
    userHasPermission(user, PERMISSIONS.BLOG_PUBLISH),
  ]);

  return (
    <>
      <PageHeader
        title="Write an article"
        description="Give it a title, a picture and a summary. Images can be attached once it is saved."
      />
      <BlogTabs active="/dashboard/blog/new" />
      <BlogPostForm post={null} categories={categories} mayPublish={mayPublish} mayDelete={false} />
    </>
  );
}
