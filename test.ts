import StuntFetcher from ".";

async function main() {
  const sf = new StuntFetcher();

  sf.once("open", () => {
    sf.getServers(false).then((servers) => {
      console.log(servers);
    });
  });

  setTimeout(() => {}, 10000);
};

main();
