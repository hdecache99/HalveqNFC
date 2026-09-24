import { useState, type ReactNode } from 'react'
import { ArrowRight, Building2, Link2, Nfc, Palette, Smartphone, Tags, Users } from 'lucide-react'
import type { ViewKey } from '../types'

type Step = { title: string; body: ReactNode; action?: { label: string; view: ViewKey } }

function Steps({ steps, go }: { steps: Step[]; go: (view: ViewKey) => void }) {
  return <ol className="tutorial-steps">{steps.map((step, index) => <li key={step.title}><span className="step-number">{index + 1}</span><div><strong>{step.title}</strong><div className="step-body">{step.body}</div>{step.action && <button className="text-link" onClick={() => go(step.action!.view)}>{step.action.label} <ArrowRight size={13} /></button>}</div></li>)}</ol>
}

function Section({ id, icon, title, subtitle, children, open = false }: { id: string; icon: ReactNode; title: string; subtitle: string; children: ReactNode; open?: boolean }) {
  return <details className="panel tutorial-section" id={id} open={open}><summary><span className="tag-icon coral">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span></summary><div className="tutorial-content">{children}</div></details>
}

export function TutorialView({ isPlatformAdmin, canManage, go }: { isPlatformAdmin: boolean; canManage: boolean; go: (view: ViewKey) => void }) {
  const [audience, setAudience] = useState<'empresa' | 'plataforma'>(isPlatformAdmin ? 'plataforma' : 'empresa')

  return <div className="admin-page tutorial">
    <section className="page-heading"><div><p className="eyebrow">CENTRO DE AYUDA</p><h1>Tutorial <span>✦</span></h1><p className="subheading">Todo lo que necesitas para dejar tus placas NFC funcionando, paso a paso.</p></div></section>
    {isPlatformAdmin && <div className="segmented large"><button className={audience === 'plataforma' ? 'selected' : ''} onClick={() => setAudience('plataforma')}>Para ti (plataforma)</button><button className={audience === 'empresa' ? 'selected' : ''} onClick={() => setAudience('empresa')}>Para tus clientes (empresas)</button></div>}

    <section className="panel concept-panel">
      <h2>¿Cómo funciona?</h2>
      <div className="concept-flow">
        <div><span className="tag-icon coral"><Nfc size={16} /></span><strong>Placa NFC</strong><small>El objeto físico que el cliente toca con su celular.</small></div><ArrowRight size={16} />
        <div><span className="tag-icon blue"><Tags size={16} /></span><strong>Tag</strong><small>El registro de esa placa en la consola, con su propia URL.</small></div><ArrowRight size={16} />
        <div><span className="tag-icon green"><Palette size={16} /></span><strong>Perfil</strong><small>La página con tu logo, colores y botones (tipo Linktree).</small></div><ArrowRight size={16} />
        <div><span className="tag-icon yellow"><Link2 size={16} /></span><strong>Enlaces</strong><small>Los botones: Instagram, WhatsApp, menú, reseñas…</small></div>
      </div>
      <p className="field-hint">La placa guarda <strong>solo la URL del tag</strong>. Por eso puedes cambiar el diseño, los enlaces o incluso el perfil completo <strong>sin volver a grabar la placa</strong>.</p>
    </section>

    {audience === 'plataforma' && isPlatformAdmin && <>
      <Section id="alta" icon={<Building2 size={16} />} title="Dar de alta una empresa nueva" subtitle="Cuando un cliente te compra placas" open>
        <Steps go={go} steps={[
          { title: 'Crea la empresa', body: <>Ve a <b>Empresas → Nueva empresa</b>. Escribe su nombre, contacto y cuántas placas compró. Las notas internas solo las ves tú.</>, action: { label: 'Ir a Empresas', view: 'empresas' } },
          { title: 'Dale acceso a su administrador', body: <>Al crearla se abre "Invitar persona". Escribe el nombre y correo del dueño y elige <b>Administrador</b>. Si ya tiene cuenta, entra de inmediato; si no, dile que se registre en la consola con ese mismo correo.</> },
          { title: '(Opcional) Configúrala tú', body: <>Pulsa <b>Entrar</b> en la fila de la empresa. Verás su consola como si fueras ellos: crea sus tags, sube su logo y agrega sus enlaces antes de entregar las placas.</> },
          { title: 'Graba y entrega las placas', body: <>Copia la URL de cada tag y grábala en su placa (ver "Grabar una placa" abajo). Prueba cada una con tu celular antes de entregarla.</> },
        ]} />
      </Section>
      <Section id="mantenimiento" icon={<Building2 size={16} />} title="Mantenimiento de empresas" subtitle="Editar, suspender, cambiar de empresa">
        <Steps go={go} steps={[
          { title: 'Cambiar entre empresas', body: <>Usa el selector de empresa arriba a la izquierda del menú, o <b>Entrar</b> desde la tabla de Empresas. Todo lo que ves (tags, perfiles, equipo) es de la empresa seleccionada.</> },
          { title: 'Actualizar datos', body: <>El lápiz ✏️ en la tabla permite cambiar nombre, contacto, placas vendidas y notas. La columna <b>Tags</b> te avisa cuántas placas faltan por configurar.</> },
          { title: 'Suspender (por falta de pago, por ejemplo)', body: <>El botón ⏸ suspende la empresa: su equipo no puede entrar y sus placas muestran "Perfil no disponible". <b>No se borra nada</b>; ▶ la reactiva al instante.</> },
          { title: 'Eliminar', body: <>El bote 🗑 borra la empresa y todo su contenido para siempre. Pide escribir el nombre para confirmar. Úsalo solo si estás seguro; normalmente conviene suspender.</> },
          { title: 'Dar acceso a más personas', body: <>El ícono 👤+ invita a alguien directamente a una empresa sin tener que entrar a ella.</> },
        ]} />
      </Section>
    </>}

    <Section id="primer-tag" icon={<Tags size={16} />} title="Configura tu primera placa" subtitle="De cero a funcionando en 5 minutos" open={audience === 'empresa'}>
      <Steps go={go} steps={[
        { title: 'Crea un tag', body: <>En <b>Tags NFC</b>, escribe un nombre para identificar la placa (ej. "Mostrador") y el nombre de tu negocio. La dirección se llena sola. Deja "Crear un perfil nuevo" si es tu primera placa.</>, action: { label: 'Ir a Tags NFC', view: 'tags' } },
        { title: 'Personaliza tu perfil', body: <>En <b>Perfiles y enlaces → Diseño</b> sube tu logo, elige un tema rápido o tus propios colores y fondo, y escribe una descripción corta. La vista previa del celular muestra cómo quedará. Pulsa <b>Guardar diseño</b>.</>, action: { label: 'Ir a Perfiles', view: 'perfiles' } },
        { title: 'Agrega tus enlaces', body: <>En la pestaña <b>Enlaces</b> escribe el texto del botón y la dirección. Usa las flechas para ordenarlos y el ojo 👁 para ocultar uno sin borrarlo.</> },
        { title: 'Graba la placa', body: <>Sigue la sección "Grabar una placa" de abajo.</> },
        { title: 'Revisa tus resultados', body: <>En <b>Resumen</b> y <b>Analítica</b> verás cuántas veces se escanean tus placas y qué botones se pulsan.</>, action: { label: 'Ir a Analítica', view: 'analitica' } },
      ]} />
    </Section>

    <Section id="grabar" icon={<Smartphone size={16} />} title="Grabar una placa NFC" subtitle="Con la app gratuita NFC Tools (iPhone y Android)">
      <Steps go={go} steps={[
        { title: 'Copia la URL del tag', body: <>En <b>Tags NFC</b>, pulsa <b>Copiar URL</b> en el tag que vas a grabar. Si lo haces desde la computadora, envíatela al celular (WhatsApp, correo…).</>, action: { label: 'Ir a Tags NFC', view: 'tags' } },
        { title: 'Instala NFC Tools', body: <>Descárgala gratis desde App Store o Google Play. En Android, activa NFC en Ajustes → Conexiones.</> },
        { title: 'Escribe la URL', body: <>Abre NFC Tools → <b>Escribir</b> → <b>Añadir un registro</b> → <b>URL / URI</b>. Pega la dirección completa (empieza con https://) y confirma.</> },
        { title: 'Acerca la placa', body: <>Pulsa <b>Escribir</b> y acerca la placa a la parte superior trasera (iPhone) o al centro trasero (Android) hasta que confirme.</> },
        { title: 'Prueba', body: <>Bloquea y desbloquea el celular y acerca la placa: debe abrir tu perfil. En iPhone aparece una notificación que hay que tocar.</> },
      ]} />
      <p className="callout-text">⚠️ NFC Tools ofrece "Bloquear la etiqueta". Eso impide volver a grabarla <b>para siempre</b>. No es necesario: como la placa solo guarda la URL, puedes cambiar todo desde la consola sin tocarla.</p>
    </Section>

    {canManage && <Section id="equipo" icon={<Users size={16} />} title="Invitar a tu equipo" subtitle="Da acceso a otras personas de tu negocio">
      <Steps go={go} steps={[
        { title: 'Invita', body: <>Ve a <b>Equipo → Invitar persona</b>, escribe su nombre y correo y elige el rol.</>, action: { label: 'Ir a Equipo', view: 'equipo' } },
        { title: 'Que se registre', body: <>Si esa persona aún no tiene cuenta, aparecerá como "Esperando registro". Pídele que entre a la consola, elija <b>Crear cuenta</b> con ese mismo correo y lo confirme. Tendrá acceso automáticamente.</> },
        { title: 'Roles', body: <><b>Administrador</b>: todo, incluido invitar gente y cambiar los datos de la empresa. <b>Operador</b>: tags, perfiles, enlaces y resultados.</> },
        { title: 'Quitar acceso', body: <>Puedes pausar el acceso (clic en el estado) o eliminarlo con el bote 🗑. La cuenta de la persona no se borra.</> },
      ]} />
    </Section>}

    <Section id="faq" icon={<Link2 size={16} />} title="Preguntas frecuentes" subtitle="Dudas comunes">
      <dl className="faq">
        <dt>¿Si cambio mis enlaces tengo que volver a grabar la placa?</dt><dd>No. Los cambios en perfiles y enlaces se ven al instante en todas las placas.</dd>
        <dt>¿Puedo tener varias placas que abran la misma página?</dt><dd>Sí. Crea un tag por placa y elige el mismo perfil en "Perfil que abrirá". Así ves las estadísticas de cada placa por separado.</dd>
        <dt>¿Puedo cambiar lo que abre una placa ya instalada?</dt><dd>Sí. En <b>Tags NFC</b>, cambia el perfil asignado en la lista desplegable del tag.</dd>
        <dt>¿Qué pasa si pauso un tag o un perfil?</dt><dd>Quien escanee verá "Perfil no disponible" hasta que lo reactives. No se pierde nada.</dd>
        <dt>¿Qué celulares pueden leer las placas?</dt><dd>iPhone XS o más reciente (sin app, con la pantalla desbloqueada) y la mayoría de los Android con NFC activado.</dd>
        <dt>No me llega el correo de confirmación</dt><dd>Revisa spam o promociones. En la pantalla de inicio también puedes usar "Olvidé mi contraseña".</dd>
        <dt>Entro y dice que no tengo acceso</dt><dd>Tu cuenta existe, pero nadie te ha invitado a una empresa con ese correo. Pide al administrador que te invite y pulsa "Ya me invitaron".</dd>
      </dl>
    </Section>
  </div>
}
