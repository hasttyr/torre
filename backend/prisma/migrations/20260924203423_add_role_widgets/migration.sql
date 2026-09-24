-- CreateTable
CREATE TABLE "role_widgets" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "widget_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "role_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_widgets_role_id_widget_key_key" ON "role_widgets"("role_id", "widget_key");

-- CreateIndex
CREATE UNIQUE INDEX "role_widgets_role_id_position_key" ON "role_widgets"("role_id", "position");

-- AddForeignKey
ALTER TABLE "role_widgets" ADD CONSTRAINT "role_widgets_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
