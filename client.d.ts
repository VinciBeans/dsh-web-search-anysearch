/**
 * @wenqi_bian/dsh-web-search-anysearch/client - browser half typings.
 *
 * The browser half loads only when the package is composed in a dsh web
 * profile (`dsh.client` + `exports["./client"]`); it registers the switch
 * card into the Plugins settings page. Consumers never import it.
 */

/** Cordis plugin id. */
export declare const name: 'web-search-anysearch'

/** Services the browser half injects. */
export declare const inject: readonly string[]

/** Cordis plugin activation (browser context). */
export declare function apply(ctx: unknown): void
