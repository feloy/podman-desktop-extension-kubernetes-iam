<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { faDownload } from '@fortawesome/free-solid-svg-icons';
import { getContext } from 'svelte';
import { Remote } from '/@/remote/remote';
import { API_IAM } from '@kubernetes-iam/channels';
import type { IamApi } from '@kubernetes-iam/channels';
import type { UserUI } from './UserUI';

const { object }: { object: UserUI } = $props();
const remote = getContext<Remote>(Remote);

let inProgress = $state(false);

async function onClick(): Promise<void> {
  inProgress = true;
  try {
    const iamApi = remote.getProxy<IamApi>(API_IAM);
    await iamApi.generateKubeconfig({
      username: object.name,
    });
  } finally {
    inProgress = false;
  }
}
</script>

<Button title="Download Kubeconfig" icon={faDownload} type="link" inProgress={inProgress} onclick={onClick} />
