<script lang="ts">
import Route from '/@/Route.svelte';
import IamDashboard from '/@/component/IamDashboard.svelte';
import UsersList from '/@/component/UsersList.svelte';
import UserDetails from '/@/component/UserDetails.svelte';
</script>

<IamDashboard>
  <Route path="/*" firstmatch let:meta>
    <Route path="/users/:contextName/:name" let:meta>
      {@const ctx = decodeURIComponent(meta.params.contextName)}
      <UserDetails contextName={ctx === '-' ? '' : ctx} name={decodeURIComponent(meta.params.name)} />
    </Route>
    <Route path="/">
      <UsersList />
    </Route>
  </Route>
</IamDashboard>
