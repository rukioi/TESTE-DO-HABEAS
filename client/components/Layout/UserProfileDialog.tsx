import React, { useState } from "react";
import {
  createSafeOnOpenChange,
  createSafeDialogHandler,
} from "@/lib/dialog-fix";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, Save } from "lucide-react";
import { apiService } from "@/services/apiService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";

const profileSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    bio: z.string().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && data.newPassword !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Senhas não coincidem",
      path: [ "confirmPassword" ],
    },
  )
  .refine(
    (data) => {
      // Se for alterar senha, senha atual é obrigatória
      if (data.newPassword && !data.currentPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Senha atual é obrigatória para alterar a senha",
      path: [ "currentPassword" ],
    },
  )
  .refine(
    (data) => {
      // Se houver nova senha, deve ter no mínimo 8 caracteres
      if (data.newPassword && data.newPassword.length < 8) {
        return false;
      }
      return true;
    },
    {
      message: "A nova senha deve ter pelo menos 8 caracteres",
      path: [ "newPassword" ],
    },
  );

type ProfileFormData = z.infer<typeof profileSchema>;

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({
  open,
  onOpenChange,
}: UserProfileDialogProps) {
  const [ isLoading, setIsLoading ] = useState(false);
  const [ avatarUrl, setAvatarUrl ] = useState("/placeholder.svg");
  const [ avatarFile, setAvatarFile ] = useState<File | null>(null);
  const { user } = useAuth();

  // Create safe onOpenChange handler
  const safeOnOpenChange = createSafeOnOpenChange(onOpenChange);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      bio: "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: user?.name || "",
        email: user?.email || "",
        phone: "",
        bio: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setAvatarUrl(user?.avatar || "/placeholder.svg");
      setAvatarFile(null);
    }
  }, [ open, user ]);

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[ 0 ];
    if (file) {
      // Validate file type
      const validTypes = [
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/svg+xml",
      ];
      if (!validTypes.includes(file.type)) {
        alert("Por favor, selecione apenas arquivos PNG, JPEG ou SVG.");
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert("O arquivo deve ter no máximo 5MB.");
        return;
      }

      setAvatarFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setAvatarUrl(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = createSafeDialogHandler(() => {
    // Reset form and state
    form.reset();
    setAvatarUrl("/placeholder.svg");
    setAvatarFile(null);
    setIsLoading(false);
    safeOnOpenChange(false);
  });

  const handleSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("email", data.email);
      if (data.newPassword) {
        formData.append("currentPassword", data.currentPassword || "");
        formData.append("newPassword", data.newPassword);
      }
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }
      const res = await apiService.updateProfile(formData);
      toast({
        title: "Perfil atualizado",
        description: data.newPassword ? "Senha alterada com sucesso." : "Dados do perfil atualizados.",
      });
      handleClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Falha ao atualizar",
        description: error instanceof Error ? error.message : "Erro ao salvar alterações do perfil",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={safeOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
          <DialogDescription>
            Atualize suas informações pessoais e configurações de conta.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Avatar Section */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl} alt="Foto do perfil" />
                <AvatarFallback className="text-lg">AD</AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    document.getElementById("avatar-upload")?.click()
                  }
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Alterar Foto
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG, JPEG ou SVG. Máximo 5MB.
                </p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Informações Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="seu@email.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(11) 99999-9999" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio/Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Conte um pouco sobre você..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Password Change */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Alterar Senha</h3>
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha Atual</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Digite sua senha atual"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Nova senha"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Nova Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Confirme a nova senha"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  "Salvando..."
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
